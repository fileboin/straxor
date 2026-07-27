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
  readOnly?: boolean; // default: true
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

export interface DatabaseAdapter {
  // Connection
  connect(config: DatabaseConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Schema browsing
  getStats(machineId: string, database: string): Promise<TableStats>;
  listTables(machineId: string, database: string): Promise<TableInfo[]>;
  getTableColumns(machineId: string, database: string, table: string): Promise<ColumnInfo[]>;
  getTableIndexes(machineId: string, database: string, table: string): Promise<IndexInfo[]>;
  getForeignKeys(machineId: string, database: string): Promise<ForeignKey[]>;
  getTableDDL(machineId: string, database: string, table: string): Promise<string>;

  // Query execution
  query(machineId: string, database: string, sql: string, readOnly?: boolean): Promise<QueryResult>;

  // List databases
  listDatabases(machineId: string): Promise<string[]>;
}
