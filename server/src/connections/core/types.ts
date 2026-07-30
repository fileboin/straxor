export type ConnectionCategory =
  | "automation" | "hardware" | "network" | "cloud" | "ai" | "custom";

export type ConnectionStatus = "connected" | "disconnected" | "error" | "pending";

export type ConnectionAuthType = "none" | "api-key" | "oauth2" | "basic" | "bearer" | "custom";

export interface ConfigField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "password" | "select" | "multiselect" | "json" | "url";
  required: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  description?: string;
  options?: { label: string; value: string }[];
}

export interface ConnectionAdapter {
  name: string;
  displayName: string;
  category: ConnectionCategory;
  description: string;
  icon: string;
  authType: ConnectionAuthType;
  configSchema: ConfigField[];
  testConnection(config: Record<string, unknown>): Promise<ConnectionTestResult>;
  execute(operation: string, config: Record<string, unknown>, payload?: unknown): Promise<ExecuteResult>;
  getOperations(): ConnectionOperation[];
}

export interface ConnectionOperation {
  id: string;
  name: string;
  description: string;
  inputSchema: ConfigField[];
  outputSchema: ConfigField[];
}

export interface ConnectionInstance {
  id: string;
  adapterName: string;
  name: string;
  category: ConnectionCategory;
  config: Record<string, unknown>;
  status: ConnectionStatus;
  lastTestedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectionTestResult {
  success: boolean;
  latency: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface ExecuteResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  statusCode?: number;
  headers?: Record<string, string>;
}

export interface ConnectionEvent {
  type: "connection:created" | "connection:updated" | "connection:deleted" | "connection:connected" | "connection:disconnected" | "connection:error";
  connectionId: string;
  adapterName: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export const CATEGORY_DISPLAY: Record<ConnectionCategory, string> = {
  automation: "Automation",
  hardware: "Hardware",
  network: "Network",
  cloud: "Cloud",
  ai: "AI",
  custom: "Custom",
};

export const CATEGORY_ICON: Record<ConnectionCategory, string> = {
  automation: "⚡",
  hardware: "🔧",
  network: "🌐",
  cloud: "☁️",
  ai: "🤖",
  custom: "🧩",
};
