import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";
import { createPostgresAdapter } from "../adapters/database/postgres.js";

const router = Router();

function getDb(userId: string) {
  const runtime = getAdapters().runtime(userId);
  const exec = (machineId: string, cmd: string) => runtime.executeCommand(machineId, cmd);
  return createPostgresAdapter(exec);
}

// POST /api/database/connect — test connection
router.post("/connect", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, engine, host, port, database, username, password, connectionString } = req.body;
    if (!machineId || !database) return res.status(400).json({ error: "machineId and database required" });

    const db = getDb(userId);
    await db.connect({ machineId, engine: engine || "postgresql", host, port, database, username, password, connectionString });
    res.json({ connected: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Connection failed" });
  }
});

// GET /api/database/databases — list databases
router.get("/databases", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, host, port, username, password } = req.query;
    if (!machineId) return res.status(400).json({ error: "machineId required" });

    const db = getDb(userId);
    await db.connect({ machineId, engine: "postgresql", host, port: port ? parseInt(port, 10) : undefined, database: "postgres", username, password });
    const databases = await db.listDatabases(machineId);
    res.json(databases);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to list databases" });
  }
});

// GET /api/database/stats — database stats
router.get("/stats", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, database, host, port, username, password } = req.query;
    if (!machineId || !database) return res.status(400).json({ error: "machineId and database required" });

    const db = getDb(userId);
    await db.connect({ machineId, engine: "postgresql", host, port: port ? parseInt(port, 10) : undefined, database, username, password });
    const stats = await db.getStats(machineId, database);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get stats" });
  }
});

// GET /api/database/tables — list tables
router.get("/tables", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, database, host, port, username, password } = req.query;
    if (!machineId || !database) return res.status(400).json({ error: "machineId and database required" });

    const db = getDb(userId);
    await db.connect({ machineId, engine: "postgresql", host, port: port ? parseInt(port, 10) : undefined, database, username, password });
    const tables = await db.listTables(machineId, database);
    res.json(tables);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to list tables" });
  }
});

// GET /api/database/columns — table columns
router.get("/columns", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, database, table, host, port, username, password } = req.query;
    if (!machineId || !database || !table) return res.status(400).json({ error: "machineId, database, and table required" });

    const db = getDb(userId);
    await db.connect({ machineId, engine: "postgresql", host, port: port ? parseInt(port, 10) : undefined, database, username, password });
    const columns = await db.getTableColumns(machineId, database, table);
    res.json(columns);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get columns" });
  }
});

// GET /api/database/indexes — table indexes
router.get("/indexes", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, database, table, host, port, username, password } = req.query;
    if (!machineId || !database || !table) return res.status(400).json({ error: "machineId, database, and table required" });

    const db = getDb(userId);
    await db.connect({ machineId, engine: "postgresql", host, port: port ? parseInt(port, 10) : undefined, database, username, password });
    const indexes = await db.getTableIndexes(machineId, database, table);
    res.json(indexes);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get indexes" });
  }
});

// GET /api/database/foreign-keys — all foreign keys
router.get("/foreign-keys", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, database, host, port, username, password } = req.query;
    if (!machineId || !database) return res.status(400).json({ error: "machineId and database required" });

    const db = getDb(userId);
    await db.connect({ machineId, engine: "postgresql", host, port: port ? parseInt(port, 10) : undefined, database, username, password });
    const fks = await db.getForeignKeys(machineId, database);
    res.json(fks);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get foreign keys" });
  }
});

// GET /api/database/ddl — table DDL
router.get("/ddl", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, database, table, host, port, username, password } = req.query;
    if (!machineId || !database || !table) return res.status(400).json({ error: "machineId, database, and table required" });

    const db = getDb(userId);
    await db.connect({ machineId, engine: "postgresql", host, port: port ? parseInt(port, 10) : undefined, database, username, password });
    const ddl = await db.getTableDDL(machineId, database, table);
    res.json({ ddl });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get DDL" });
  }
});

// POST /api/database/query — execute query
router.post("/query", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, database, sql, readOnly, host, port, username, password } = req.body;
    if (!machineId || !database || !sql) return res.status(400).json({ error: "machineId, database, and sql required" });

    const db = getDb(userId);
    await db.connect({ machineId, engine: "postgresql", host, port, database, username, password });
    const result = await db.query(machineId, database, sql, readOnly !== false);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Query failed" });
  }
});

export default router;
