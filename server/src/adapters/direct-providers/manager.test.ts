// ── DirectProviderManager: on-the-spot key save → retrieve round-trip ──
// Verifies the exact flow the UI uses to store and reuse an API key:
//   InlineApiKeyForm / ProvidersPanel → saveKey (encrypt → user_api_keys)
//   → chat getKey (decrypt)  → used by /api/chat and the OpenCode engine.
// The DB layer is mocked in-memory so this runs offline and deterministically.

import { describe, it, expect, beforeEach, vi } from "vitest";

const KEY_64HEX = "0a".repeat(32);

// Hoisted in-memory store so the vi.mock factory (which is hoisted above
// imports) can reference it without scope errors.
const h = vi.hoisted(() => {
  const store = new Map<string, { userId: string; providerId: string; encryptedKey: string }>();
  let idSeq = 0;

  // drizzle eq()/and() produce an SQL object whose `queryChunks` array carries
  // bound parameters as chunks shaped like { value: <literal>, encoder: <column> }.
  // Extract each `{ columnName, value }` pair so we can match against a row.
  function extractConditions(cond: any): { column: string; value: unknown }[] {
    const out: { column: string; value: unknown }[] = [];
    const chunks = cond?.queryChunks;
    if (!Array.isArray(chunks)) return out;
    for (const c of chunks) {
      if (c && typeof c === "object" && c.encoder && typeof c.encoder.name === "string") {
        out.push({ column: c.encoder.name, value: c.value });
      }
    }
    return out;
  }

  const COLUMN_TO_FIELD: Record<string, "userId" | "providerId"> = {
    user_id: "userId",
    provider_id: "providerId",
  };

  function rMatches(row: { userId: string; providerId: string }, cond: any): boolean {
    const conds = extractConditions(cond);
    if (conds.length === 0) return true;
    return conds.every((c) => {
      const field = COLUMN_TO_FIELD[c.column];
      if (!field) return true; // unknown column — don't over-restrict
      return row[field] === c.value;
    });
  }

  return {
    store,
    rMatches,
    nextId: () => `row-${idSeq++}`,
    // A value that is both thenable (bare `await ...where()`) and exposes
    // `.returning()` (for queries that call it). The work runs exactly once,
    // via whichever accessor the caller uses.
    thenable(doWork: () => { userId: string; providerId: string; encryptedKey: string }[]) {
      let result: { userId: string; providerId: string; encryptedKey: string }[] | null = null;
      const run = () => (result === null ? (result = doWork()) : result);
      const obj: any = {
        then(onFulfilled: any) {
          return Promise.resolve(run()).then(onFulfilled);
        },
        returning() {
          return Promise.resolve(run());
        },
      };
      return obj;
    },
  };
});

vi.mock("../../db/index.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (cond: any) => ({
          limit: () =>
            Promise.resolve(
              Array.from(h.store.values()).filter((r) => h.rMatches(r, cond))
            ),
        }),
      }),
    }),
    update: (_table: any) => ({
      set: (vals: any) => ({
        where: (cond: any) =>
          h.thenable(() => {
            for (const r of Array.from(h.store.values()).filter((x) => h.rMatches(x, cond))) {
              Object.assign(r, vals);
            }
            return [];
          }),
      }),
    }),
    insert: (_table: any) => ({
      values: (vals: any) => {
        const row = { ...vals, id: h.nextId() };
        h.store.set(`${row.userId}:${row.providerId}`, row);
        return Promise.resolve([row]);
      },
    }),
    delete: (_table: any) => ({
      where: (cond: any) =>
        h.thenable(() => {
          const rows = Array.from(h.store.values()).filter((r) => h.rMatches(r, cond));
          for (const r of rows) h.store.delete(`${r.userId}:${r.providerId}`);
          return rows;
        }),
    }),
  },
}));

import { getDirectProviderManager } from "./manager.js";
import { DIRECT_PROVIDERS } from "./types.js";

beforeEach(() => {
  process.env.ENCRYPTION_KEY = KEY_64HEX;
  h.store.clear();
});

describe("DirectProviderManager on-the-spot key flow", () => {
  it("Together AI je registrovan kao podržani provajder", () => {
    const def = DIRECT_PROVIDERS.find((p) => p.id === "together");
    expect(def).toBeDefined();
    expect(def!.name).toBe("Together AI");
    expect(def!.authMethod).toBe("api-key");
    expect(def!.models.length).toBeGreaterThan(0);
  });

  it("saveKey → getKey round-trip (šifrovano u bazi, dekriptovano nazad)", async () => {
    const manager = getDirectProviderManager();
    const key = "tgp_v1_together-dummy-key-1234567890";
    await manager.saveKey("user-1", "together", key);

    const stored = Array.from(h.store.values())[0];
    expect(stored.encryptedKey).not.toContain(key);

    expect(await manager.getKey("user-1", "together")).toBe(key);
  });

  it("saveKey ažurira postojeći ključ umjesto dupliranja", async () => {
    const manager = getDirectProviderManager();
    await manager.saveKey("user-1", "openai", "old-key");
    await manager.saveKey("user-1", "openai", "new-key");

    expect(h.store.size).toBe(1);
    expect(await manager.getKey("user-1", "openai")).toBe("new-key");
  });

  it("getKey vraća null kad ključ ne postoji", async () => {
    const manager = getDirectProviderManager();
    expect(await manager.getKey("user-1", "together")).toBeNull();
  });

  it("getStatus otkriva sačuvan ključ (hasKey + keyPreview)", async () => {
    const manager = getDirectProviderManager();
    await manager.saveKey("user-1", "together", "tgp_v1_abc123def456");
    const status = await manager.getStatus("user-1", DIRECT_PROVIDERS.find((p) => p.id === "together")!);
    expect(status.hasKey).toBe(true);
    expect(status.isEnabled).toBe(true);
    expect(status.keyPreview).toContain("••••");
  });

  it("deleteKey uklanja ključ iz baze", async () => {
    const manager = getDirectProviderManager();
    await manager.saveKey("user-1", "groq", "gsk_xyz");
    expect(await manager.deleteKey("user-1", "groq")).toBe(true);
    expect(await manager.getKey("user-1", "groq")).toBeNull();
  });
});
