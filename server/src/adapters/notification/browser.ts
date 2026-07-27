import type { NotificationAdapter, NotificationEvent, NotificationResult } from "./adapter.js";

// Browser Notification — Web Push API (client-side only, backend stores config)
export function createBrowserNotificationAdapter(): NotificationAdapter {
  return {
    id: "browser",
    name: "Browser",
    async isAvailable() {
      return true; // Always available on client
    },
    async send(event: NotificationEvent): Promise<NotificationResult> {
      try {
        // Server-side: store for client polling
        // Client-side: actual Notification API call happens in browser
        // This adapter is a no-op on server, real logic lives in client lib
        return {
          channel: "browser",
          success: true,
          sentAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          channel: "browser",
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
          sentAt: new Date().toISOString(),
        };
      }
    },
  };
}
