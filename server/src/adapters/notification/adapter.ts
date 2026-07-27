export type NotificationChannel = "browser" | "os" | "telegram" | "discord" | "slack" | "email";
export type NotificationEventType =
  | "task_completed"
  | "deploy_error"
  | "input_required"
  | "security_warning"
  | "build_finished"
  | "scan_complete"
  | "machine_offline"
  | "custom";

export interface NotificationEvent {
  type: NotificationEventType;
  title: string;
  body: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
  severity: "info" | "success" | "warning" | "error";
  timestamp: string;
}

export interface NotificationConfig {
  channel: NotificationChannel;
  enabled: boolean;
  events: NotificationEventType[];
  config: Record<string, string>;
}

export interface NotificationResult {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
  sentAt: string;
}

export interface NotificationAdapter {
  id: NotificationChannel;
  name: string;
  isAvailable(config: Record<string, string>): Promise<boolean>;
  send(event: NotificationEvent, config: Record<string, string>): Promise<NotificationResult>;
}

export const EVENT_TYPE_LABELS: Record<NotificationEventType, { label: string; icon: string; color: string }> = {
  task_completed: { label: "Zadatak završen", icon: "✓", color: "text-green-400" },
  deploy_error: { label: "Deploy greška", icon: "✕", color: "text-red-400" },
  input_required: { label: "Potreban input", icon: "?", color: "text-yellow-400" },
  security_warning: { label: "Security upozorenje", icon: "⬡", color: "text-orange-400" },
  build_finished: { label: "Build završen", icon: "◆", color: "text-accent-blue" },
  scan_complete: { label: "Skeniranje završeno", icon: "🔍", color: "text-accent" },
  machine_offline: { label: "Mašina offline", icon: "⏻", color: "text-red-400" },
  custom: { label: "Prilagođeno", icon: "◉", color: "text-text-muted" },
};

export const CHANNEL_LABELS: Record<NotificationChannel, { label: string; icon: string; description: string }> = {
  browser: { label: "Browser", icon: "🌐", description: "Browser push notifikacije" },
  os: { label: "OS", icon: "💻", description: "Sistemsko obavještenje" },
  telegram: { label: "Telegram", icon: "✈", description: "Telegram bot poruka" },
  discord: { label: "Discord", icon: "◈", description: "Discord webhook" },
  slack: { label: "Slack", icon: "◻", description: "Slack webhook" },
  email: { label: "Email", icon: "✉", description: "Email obavještenje" },
};
