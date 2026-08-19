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

  // Self-heal: an existing DB was baselined without running old journal entries,
  // so tables added mid-lifecycle (e.g. agent_bus_events) may be missing. Check
  // each known table and run its migration file idempotently if absent.
  const ensureTables: Record<string, string> = {
    agent_bus_events: "0008_agent_bus_events",
  };
  for (const [table, tag] of Object.entries(ensureTables)) {
    const [exists] = await client`
      select count(*)::int as n from information_schema.tables
      where table_schema = 'public' and table_name = ${table}
    `;
    if (exists && exists.n > 0) continue;
    const file = path.join(drizzleDir, `${tag}.sql`);
    if (!fs.existsSync(file)) continue;
    console.log(`[migrate] Missing table "${table}" — applying ${tag}.sql`);
    const sqlText = fs.readFileSync(file, "utf8");
    const statements = sqlText
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await client.unsafe(stmt);
    }
  }

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

  // Apply all journal entries whose tag has NOT yet been recorded as applied.
  // On a truly fresh DB every entry runs; on an existing DB only genuinely new
  // migrations run (their SQL is written idempotently so re-running is safe).
  const toRun = entries.filter((e) => !applied.has(e.tag));

  if (!isFresh && applied.size === 0) {
    // Existing DB but no baseline yet: ALL known migrations were applied
    // historically (some manually). Baseline them so old SQL never re-runs and
    // fails with "already exists". Any migration that was added after this
    // baseline will run on the next boot.
    let seeded = 0;
    for (const entry of entries) {
      if (applied.has(entry.tag)) continue;
      await client`insert into "__drizzle_migrations" (hash, created_at) values (${entry.tag}, ${Date.now()})`;
      applied.add(entry.tag);
      seeded++;
    }
    console.log(`[migrate] Existing DB with no baseline — baselined ${seeded} migration(s). New ones run on next boot.`);
    await client.end();
    return;
  }

  if (toRun.length === 0) {
    await client.end();
    return;
  }

  console.log(
    `[migrate] Applying ${toRun.length} pending migration(s) on a ${isFresh ? "fresh" : "existing"} DB...`
  );
  for (const entry of toRun) {
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
  console.log("[migrate] All pending migrations applied.");
}
