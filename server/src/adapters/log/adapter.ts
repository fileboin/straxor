export type LogCategory = "runtime" | "agent" | "git" | "ssh" | "error" | "deployment";
export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  id: string;
  userId: string;
  category: LogCategory;
  level: LogLevel;
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface LogSearchParams {
  category?: LogCategory;
  level?: LogLevel;
  query?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface LogAdapter {
  ingest(entry: Omit<LogEntry, "id" | "timestamp">): Promise<LogEntry>;
  search(userId: string, params: LogSearchParams): Promise<LogEntry[]>;
  exportLogs(userId: string, params: { category?: LogCategory; format: "json" | "csv" }): Promise<string>;
  stream(userId: string, category?: LogCategory): AsyncGenerator<LogEntry>;
}
