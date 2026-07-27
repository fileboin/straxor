import { db } from "../../db/index.js";
import { logs } from "../../db/schema.js";
import { eq, and, desc, sql, ilike, gte, lte } from "drizzle-orm";
import type { LogAdapter, LogEntry, LogSearchParams, LogCategory, LogLevel } from "./adapter.js";

function rowToEntry(row: typeof logs.$inferSelect): LogEntry {
  return {
    id: row.id,
    userId: row.userId,
    category: row.category as LogCategory,
    level: row.level as LogLevel,
    message: row.message,
    source: row.source || undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    timestamp: row.createdAt,
  };
}

export function createDbLogAdapter(): LogAdapter {
  const listeners = new Map<string, ((entry: LogEntry) => void)[]>();

  function notify(userId: string, entry: LogEntry) {
    const handlers = listeners.get(userId);
    if (handlers) {
      for (const handler of handlers) {
        handler(entry);
      }
    }
  }

  return {
    async ingest(entry) {
      const [row] = await db
        .insert(logs)
        .values({
          userId: entry.userId,
          category: entry.category,
          level: entry.level,
          message: entry.message,
          source: entry.source,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        })
        .returning();

      const logEntry = rowToEntry(row);
      notify(entry.userId, logEntry);
      return logEntry;
    },

    async search(userId, params) {
      const conditions = [eq(logs.userId, userId)];

      if (params.category) {
        conditions.push(eq(logs.category, params.category));
      }
      if (params.level) {
        conditions.push(eq(logs.level, params.level));
      }
      if (params.query) {
        conditions.push(ilike(logs.message, `%${params.query}%`));
      }
      if (params.startDate) {
        conditions.push(gte(logs.createdAt, params.startDate));
      }
      if (params.endDate) {
        conditions.push(lte(logs.createdAt, params.endDate));
      }

      const limit = params.limit || 100;
      const offset = params.offset || 0;

      const rows = await db
        .select()
        .from(logs)
        .where(and(...conditions))
        .orderBy(desc(logs.createdAt))
        .limit(limit)
        .offset(offset);

      return rows.map(rowToEntry);
    },

    async exportLogs(userId, params) {
      const entries = await this.search(userId, {
        category: params.category,
        limit: 10000,
      });

      if (params.format === "json") {
        return JSON.stringify(entries, null, 2);
      }

      // CSV format
      const header = "timestamp,category,level,message,source";
      const rows = entries.map(
        (e) =>
          `${e.timestamp.toISOString()},${e.category},${e.level},"${e.message.replace(/"/g, '""')}",${e.source || ""}`
      );
      return [header, ...rows].join("\n");
    },

    async *stream(userId, category) {
      let resolve: ((entry: LogEntry) => void) | null = null;
      let promise = new Promise<LogEntry>((r) => {
        resolve = r;
      });

      const handler = (entry: LogEntry) => {
        if (resolve) {
          resolve(entry);
          resolve = null;
          promise = new Promise<LogEntry>((r) => {
            resolve = r;
          });
        }
      };

      const key = userId;
      if (!listeners.has(key)) {
        listeners.set(key, []);
      }
      listeners.get(key)!.push(handler);

      try {
        while (true) {
          const entry = await promise;
          if (category && entry.category !== category) continue;
          yield entry;
        }
      } finally {
        const handlers = listeners.get(key);
        if (handlers) {
          const idx = handlers.indexOf(handler);
          if (idx >= 0) handlers.splice(idx, 1);
          if (handlers.length === 0) listeners.delete(key);
        }
      }
    },
  };
}
