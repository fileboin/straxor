import type { NotificationAdapter, NotificationEvent, NotificationResult } from "./adapter.js";

// Slack — Incoming Webhook
export function createSlackNotificationAdapter(): NotificationAdapter {
  return {
    id: "slack",
    name: "Slack",
    async isAvailable(config) {
      return !!config.webhookUrl;
    },
    async send(event: NotificationEvent, config: Record<string, string>): Promise<NotificationResult> {
      try {
        const { webhookUrl } = config;
        if (!webhookUrl) {
          return {
            channel: "slack",
            success: false,
            error: "webhookUrl required",
            sentAt: new Date().toISOString(),
          };
        }

        const colorMap: Record<string, string> = {
          info: "#3498db",
          success: "#2ecc71",
          warning: "#f39c12",
          error: "#e74c3c",
        };

        const severityLabel: Record<string, string> = {
          info: "ℹ️ Info",
          success: "✅ Uspješno",
          warning: "⚠️ Upozorenje",
          error: "❌ Greška",
        };

        const blocks = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${event.title}*\n${event.body}`,
            },
          },
        ];

        if (event.projectId) {
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `_Projekt: ${event.projectId}_`,
            },
          });
        }

        const payload = {
          username: "Straxor",
          icon_emoji: ":rocket:",
          attachments: [
            {
              color: colorMap[event.severity] || "#95a5a6",
              blocks,
              footer: `Straxor • ${severityLabel[event.severity] || event.severity}`,
              ts: Math.floor(new Date(event.timestamp).getTime() / 1000),
            },
          ],
        };

        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`Slack webhook returned ${res.status}`);
        }

        return {
          channel: "slack",
          success: true,
          sentAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          channel: "slack",
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
          sentAt: new Date().toISOString(),
        };
      }
    },
  };
}
