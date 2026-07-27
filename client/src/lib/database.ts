export type DatabaseEngine = "postgresql" | "mysql" | "sqlite" | "mongodb";

export interface DatabaseConfig {
  machineId: string;
  engine: DatabaseEngine;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  connectionString?: string;
  readOnly?: boolean;
}

export interface TableInfo {
  name: string;
  schema: string;
  rowCount: number;
  size: string;
  comment: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignTable: string | null;
  foreignColumn: string | null;
  comment: string;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  duration: number;
  truncated: boolean;
}

export interface TableStats {
  totalTables: number;
  totalRows: number;
  totalSize: string;
  engine: DatabaseEngine;
  version: string;
}

export interface ForeignKey {
  constraintName: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function connParams(config: Partial<DatabaseConfig> & { machineId: string; database: string }): Record<string, string> {
  const p: Record<string, string> = { machineId: config.machineId, database: config.database };
  if (config.host) p.host = config.host;
  if (config.port) p.port = String(config.port);
  if (config.username) p.username = config.username;
  if (config.password) p.password = config.password;
  return p;
}

export async function connectDatabase(config: DatabaseConfig): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/database/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Connection failed");
  const data = await res.json();
  return data.connected;
}

export async function listDatabases(machineId: string, host?: string, port?: number, username?: string, password?: string): Promise<string[]> {
  const params = new URLSearchParams({ machineId });
  if (host) params.set("host", host);
  if (port) params.set("port", String(port));
  if (username) params.set("username", username);
  if (password) params.set("password", password);
  const res = await fetch(`${API_BASE}/api/database/databases?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to list databases");
  return res.json();
}

export async function getDatabaseStats(config: { machineId: string; database: string }): Promise<TableStats> {
  const params = new URLSearchParams(connParams(config));
  const res = await fetch(`${API_BASE}/api/database/stats?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to get stats");
  return res.json();
}

export async function listTables(config: { machineId: string; database: string }): Promise<TableInfo[]> {
  const params = new URLSearchParams(connParams(config));
  const res = await fetch(`${API_BASE}/api/database/tables?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to list tables");
  return res.json();
}

export async function getTableColumns(config: { machineId: string; database: string; table: string }): Promise<ColumnInfo[]> {
  const params = new URLSearchParams(connParams(config));
  params.set("table", config.table);
  const res = await fetch(`${API_BASE}/api/database/columns?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to get columns");
  return res.json();
}

export async function getTableIndexes(config: { machineId: string; database: string; table: string }): Promise<IndexInfo[]> {
  const params = new URLSearchParams(connParams(config));
  params.set("table", config.table);
  const res = await fetch(`${API_BASE}/api/database/indexes?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to get indexes");
  return res.json();
}

export async function getForeignKeys(config: { machineId: string; database: string }): Promise<ForeignKey[]> {
  const params = new URLSearchParams(connParams(config));
  const res = await fetch(`${API_BASE}/api/database/foreign-keys?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to get foreign keys");
  return res.json();
}

export async function getTableDDL(config: { machineId: string; database: string; table: string }): Promise<string> {
  const params = new URLSearchParams(connParams(config));
  params.set("table", config.table);
  const res = await fetch(`${API_BASE}/api/database/ddl?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to get DDL");
  const data = await res.json();
  return data.ddl;
}

export async function executeQuery(config: { machineId: string; database: string; sql: string; readOnly?: boolean }): Promise<QueryResult> {
  const res = await fetch(`${API_BASE}/api/database/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Query failed");
  }
  return res.json();
}

export const ENGINE_LABELS: Record<DatabaseEngine, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
  mongodb: "MongoDB",
};

export const ENGINE_ICONS: Record<DatabaseEngine, string> = {
  postgresql: "🐘",
  mysql: "🐬",
  sqlite: "📄",
  mongodb: "🍃",
};
