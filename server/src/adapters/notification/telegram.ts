import type { NotificationAdapter, NotificationEvent, NotificationResult } from "./adapter.js";

// Telegram — Bot API
export function createTelegramNotificationAdapter(): NotificationAdapter {
  return {
    id: "telegram",
    name: "Telegram",
    async isAvailable(config) {
      return !!(config.botToken && config.chatId);
    },
    async send(event: NotificationEvent, config: Record<string, string>): Promise<NotificationResult> {
      try {
        const { botToken, chatId } = config;
        if (!botToken || !chatId) {
          return {
            channel: "telegram",
            success: false,
            error: "botToken and chatId required",
            sentAt: new Date().toISOString(),
          };
        }

        const severityEmoji: Record<string, string> = {
          info: "ℹ️",
          success: "✅",
          warning: "⚠️",
          error: "❌",
        };

        const text = [
          `${severityEmoji[event.severity] || "◉"} *${event.title}*`,
          "",
          event.body,
          "",
          event.projectId ? `_Projekt: ${event.projectId}_` : "",
          `_Vrijeme: ${new Date(event.timestamp).toLocaleString("hr-HR")}_`,
        ]
          .filter(Boolean)
          .join("\n");

        const res = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              parse_mode: "Markdown",
            }),
          }
        );

        if (!res.ok) {
          const data = await res.json() as { description?: string };
          throw new Error(data.description || `Telegram API returned ${res.status}`);
        }

        return {
          channel: "telegram",
          success: true,
          sentAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          channel: "telegram",
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
          sentAt: new Date().toISOString(),
        };
      }
    },
  };
}
