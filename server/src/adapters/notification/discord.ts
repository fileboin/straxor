import type { NotificationAdapter, NotificationEvent, NotificationResult } from "./adapter.js";

// Discord — Webhook
export function createDiscordNotificationAdapter(): NotificationAdapter {
  return {
    id: "discord",
    name: "Discord",
    async isAvailable(config) {
      return !!config.webhookUrl;
    },
    async send(event: NotificationEvent, config: Record<string, string>): Promise<NotificationResult> {
      try {
        const { webhookUrl } = config;
        if (!webhookUrl) {
          return {
            channel: "discord",
            success: false,
            error: "webhookUrl required",
            sentAt: new Date().toISOString(),
          };
        }

        const colorMap: Record<string, number> = {
          info: 0x3498db,
          success: 0x2ecc71,
          warning: 0xf39c12,
          error: 0xe74c3c,
        };

        const embed = {
          title: event.title,
          description: event.body,
          color: colorMap[event.severity] || 0x95a5a6,
          fields: [] as Array<{ name: string; value: string; inline: boolean }>,
          timestamp: event.timestamp,
          footer: {
            text: event.projectId ? `Straxor • ${event.projectId}` : "Straxor",
          },
        };

        if (event.projectId) {
          embed.fields.push({
            name: "Projekt",
            value: event.projectId,
            inline: true,
          });
        }

        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "Straxor",
            embeds: [embed],
          }),
        });

        if (!res.ok && res.status !== 204) {
          throw new Error(`Discord webhook returned ${res.status}`);
        }

        return {
          channel: "discord",
          success: true,
          sentAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          channel: "discord",
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
          sentAt: new Date().toISOString(),
        };
      }
    },
  };
}
