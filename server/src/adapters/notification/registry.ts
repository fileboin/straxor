import type {
  NotificationAdapter,
  NotificationChannel,
  NotificationEvent,
  NotificationConfig,
  NotificationResult,
} from "./adapter.js";
import { createBrowserNotificationAdapter } from "./browser.js";
import { createOsNotificationAdapter } from "./os.js";
import { createTelegramNotificationAdapter } from "./telegram.js";
import { createDiscordNotificationAdapter } from "./discord.js";
import { createSlackNotificationAdapter } from "./slack.js";
import { createEmailNotificationAdapter } from "./email.js";

export interface NotificationRegistry {
  getAll(): NotificationAdapter[];
  getById(id: NotificationChannel): NotificationAdapter | undefined;
  dispatch(event: NotificationEvent, configs: NotificationConfig[]): Promise<NotificationResult[]>;
  send(channel: NotificationChannel, event: NotificationEvent, config: Record<string, string>): Promise<NotificationResult>;
}

const ALL_ADAPTERS: NotificationAdapter[] = [
  createBrowserNotificationAdapter(),
  createOsNotificationAdapter(),
  createTelegramNotificationAdapter(),
  createDiscordNotificationAdapter(),
  createSlackNotificationAdapter(),
  createEmailNotificationAdapter(),
];

export function createNotificationRegistry(): NotificationRegistry {
  return {
    getAll() {
      return ALL_ADAPTERS;
    },

    getById(id: NotificationChannel) {
      return ALL_ADAPTERS.find((a) => a.id === id);
    },

    async dispatch(
      event: NotificationEvent,
      configs: NotificationConfig[]
    ): Promise<NotificationResult[]> {
      const enabledConfigs = configs.filter((c) => {
        if (!c.enabled) return false;
        if (c.events.length > 0 && !c.events.includes(event.type)) return false;
        return true;
      });

      if (enabledConfigs.length === 0) return [];

      // Send to all enabled channels in parallel
      const results = await Promise.all(
        enabledConfigs.map(async (cfg) => {
          const adapter = ALL_ADAPTERS.find((a) => a.id === cfg.channel);
          if (!adapter) {
            return {
              channel: cfg.channel,
              success: false,
              error: `Adapter ${cfg.channel} not found`,
              sentAt: new Date().toISOString(),
            };
          }

          const available = await adapter.isAvailable(cfg.config);
          if (!available) {
            return {
              channel: cfg.channel,
              success: false,
              error: `Channel ${cfg.channel} not configured`,
              sentAt: new Date().toISOString(),
            };
          }

          return adapter.send(event, cfg.config);
        })
      );

      return results;
    },

    async send(
      channel: NotificationChannel,
      event: NotificationEvent,
      config: Record<string, string>
    ): Promise<NotificationResult> {
      const adapter = ALL_ADAPTERS.find((a) => a.id === channel);
      if (!adapter) {
        return {
          channel,
          success: false,
          error: `Adapter ${channel} not found`,
          sentAt: new Date().toISOString(),
        };
      }
      return adapter.send(event, config);
    },
  };
}
