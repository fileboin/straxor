import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema.js";

/**
 * Custom startup migrator.
 *
 * The original project used drizzle-kit migrations but never tracked them in the
 * DB (no `__drizzle_migrations` table), so several `.sql` files were applied
 * manually or skipped entirely (e.g. `0008_global_vps_independent.sql`, which
 * made `machines.project_id` nullable — without it the VPS insert failed).
 *
 * To be safe we do NOT blindly re-run every journal entry on an existing DB
 * (that would fail with "already exists"). Instead:
 *   - Fresh DB (no tables)  -> run all journal entries in order.
 *   - Existing DB (tables)  -> baseline-mark every *current* journal entry as
 *     applied, so future migrations added to the journal are applied
 *     automatically going forward.
 *
 * Run at server startup, before `app.listen`.
 */
export async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[migrate] DATABASE_URL missing — skipping migrations");
    return;
  }

  const client = postgres(url, {
    max: 1,
    onnotice: () => {},
  });

  const db = drizzle(client, { schema });

  const journalPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../drizzle/meta/_journal.json"
  );
  const drizzleDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");

  if (!fs.existsSync(journalPath)) {
    console.warn("[migrate] journal not found at", journalPath, "— skipping");
    await client.end();
    return;
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries: { idx: number; tag: string }[];
  };
  const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);

  // Ensure tracking table exists.
  await client`
    create table if not exists "__drizzle_migrations" (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `;

  const appliedRows = await client`select hash from "__drizzle_migrations"`;
  const applied = new Set<string>(appliedRows.map((r) => r.hash));

  // Detect a fresh DB: no user tables at all.
  const tableRows = await client`
    select count(*)::int as n from information_schema.tables
    where table_schema = 'public'
  `;
  const isFresh = tableRows[0].n === 0;

  if (!isFresh) {
    // Existing DB: baseline all currently-known entries as applied so nothing
    // re-runs; only genuinely new future migrations will be executed.
    let seeded = 0;
    for (const entry of entries) {
      if (applied.has(entry.tag)) continue;
      await client`insert into "__drizzle_migrations" (hash, created_at) values (${entry.tag}, ${Date.now()})`;
      applied.add(entry.tag);
      seeded++;
    }
    if (seeded > 0) {
      console.log(`[migrate] Existing DB detected — baselined ${seeded} existing migration(s). Only new migrations will run.`);
    }
    await client.end();
    return;
  }

  // Fresh DB: run everything in order.
  console.log("[migrate] Fresh DB detected — applying all migrations...");
  for (const entry of entries) {
    if (applied.has(entry.tag)) continue;
    const file = path.join(drizzleDir, `${entry.tag}.sql`);
    if (!fs.existsSync(file)) {
      console.warn(`[migrate] Migration file missing: ${entry.tag}.sql — skipping`);
      continue;
    }
    const sqlText = fs.readFileSync(file, "utf8");
    const statements = sqlText
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await client.unsafe(stmt);
    }
    await client`insert into "__drizzle_migrations" (hash, created_at) values (${entry.tag}, ${Date.now()})`;
    applied.add(entry.tag);
    console.log(`[migrate] Applied ${entry.tag}`);
  }
  await client.end();
  console.log("[migrate] All migrations applied.");
}
