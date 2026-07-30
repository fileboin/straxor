const API_BASE = import.meta.env.VITE_API_URL || "";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

export interface NotificationConfig {
  id: string;
  channel: NotificationChannel;
  enabled: boolean;
  events: NotificationEventType[];
  config: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationHistoryEntry {
  id: string;
  channel: NotificationChannel;
  eventType: string;
  title: string;
  body: string;
  severity: string;
  success: boolean;
  error?: string;
  createdAt: string;
}

export interface NotificationTestResult {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
  sentAt: string;
}

export const CHANNELS: Array<{
  id: NotificationChannel;
  label: string;
  icon: string;
  description: string;
  configFields: Array<{ key: string; label: string; placeholder: string; type?: string }>;
}> = [
  {
    id: "browser",
    label: "Browser",
    icon: "🌐",
    description: "Browser push notifikacije",
    configFields: [],
  },
  {
    id: "os",
    label: "OS",
    icon: "💻",
    description: "Sistemsko obavještenje",
    configFields: [],
  },
  {
    id: "telegram",
    label: "Telegram",
    icon: "✈",
    description: "Telegram bot poruka",
    configFields: [
      { key: "botToken", label: "Bot Token", placeholder: "123456:ABC-DEF..." },
      { key: "chatId", label: "Chat ID", placeholder: "-100123456789" },
    ],
  },
  {
    id: "discord",
    label: "Discord",
    icon: "◈",
    description: "Discord webhook",
    configFields: [
      { key: "webhookUrl", label: "Webhook URL", placeholder: "https://discord.com/api/webhooks/..." },
    ],
  },
  {
    id: "slack",
    label: "Slack",
    icon: "◻",
    description: "Slack webhook",
    configFields: [
      { key: "webhookUrl", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/..." },
    ],
  },
  {
    id: "email",
    label: "Email",
    icon: "✉",
    description: "Email obavještenje (Resend)",
    configFields: [
      { key: "resendApiKey", label: "Resend API Key", placeholder: "re_...", type: "password" },
      { key: "emailTo", label: "Primaoc", placeholder: "user@example.com" },
      { key: "emailFrom", label: "Pošiljalac (opc.)", placeholder: "Straxor <notify@straxor.dev>" },
    ],
  },
];

export const EVENT_TYPES: Array<{
  id: NotificationEventType;
  label: string;
  icon: string;
  color: string;
}> = [
  { id: "task_completed", label: "Zadatak završen", icon: "✓", color: "text-green-400" },
  { id: "deploy_error", label: "Deploy greška", icon: "✕", color: "text-red-400" },
  { id: "input_required", label: "Potreban input", icon: "?", color: "text-yellow-400" },
  { id: "security_warning", label: "Security upozorenje", icon: "⬡", color: "text-orange-400" },
  { id: "build_finished", label: "Build završen", icon: "◆", color: "text-accent-blue" },
  { id: "scan_complete", label: "Skeniranje završeno", icon: "🔍", color: "text-accent" },
  { id: "machine_offline", label: "Mašina offline", icon: "⏻", color: "text-red-400" },
];

export const SEVERITY_COLORS: Record<string, string> = {
  info: "text-blue-400",
  success: "text-green-400",
  warning: "text-yellow-400",
  error: "text-red-400",
};

// API calls
export async function fetchNotificationConfigs(): Promise<NotificationConfig[]> {
  const res = await fetch(`${API_BASE}/api/notifications/configs`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function saveNotificationConfig(
  channel: NotificationChannel,
  enabled: boolean,
  events: NotificationEventType[],
  config: Record<string, string>
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/notifications/configs`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ channel, enabled, events, config }),
  });
  if (!res.ok) throw new Error("Failed to save config");
}

export async function testNotification(
  channel: NotificationChannel,
  config: Record<string, string>
): Promise<NotificationTestResult> {
  const res = await fetch(`${API_BASE}/api/notifications/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ channel, config }),
  });
  if (!res.ok) throw new Error("Test failed");
  return res.json();
}

export async function dispatchNotification(
  type: NotificationEventType,
  title: string,
  body: string,
  projectId?: string,
  severity?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/notifications/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ type, title, body, projectId, severity }),
  });
  if (!res.ok) throw new Error("Dispatch failed");
}

export async function fetchNotificationHistory(
  limit?: number
): Promise<NotificationHistoryEntry[]> {
  const query = limit ? `?limit=${limit}` : "";
  const res = await fetch(`${API_BASE}/api/notifications/history${query}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function clearNotificationHistory(): Promise<void> {
  await fetch(`${API_BASE}/api/notifications/history`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}
