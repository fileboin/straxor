import type { NotificationAdapter, NotificationEvent, NotificationResult } from "./adapter.js";

// OS Notification — node-notifier or SSH notify-send on VPS
export function createOsNotificationAdapter(): NotificationAdapter {
  return {
    id: "os",
    name: "OS",
    async isAvailable() {
      return true;
    },
    async send(event: NotificationEvent, config: Record<string, string>): Promise<NotificationResult> {
      try {
        const machineId = config.machineId;

        if (machineId) {
          // Send via SSH notify-send on VPS
          const { createBoundAdapter } = await import("../runtime/opencode.js");
          const adapter = createBoundAdapter(machineId);
          const title = event.title.replace(/"/g, '\\"');
          const body = event.body.replace(/"/g, '\\"');
          await adapter.executeCommand(
            machineId,
            `notify-send "${title}" "${body}" 2>/dev/null || true`
          );
        }
        // Local OS notification not supported server-side

        return {
          channel: "os",
          success: true,
          sentAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          channel: "os",
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
          sentAt: new Date().toISOString(),
        };
      }
    },
  };
}
