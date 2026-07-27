import type { NotificationAdapter, NotificationEvent, NotificationResult } from "./adapter.js";

// Email — SMTP via nodemailer (optional) or Resend API
export function createEmailNotificationAdapter(): NotificationAdapter {
  return {
    id: "email",
    name: "Email",
    async isAvailable(config) {
      return !!(config.email || (config.resendApiKey && config.emailTo));
    },
    async send(event: NotificationEvent, config: Record<string, string>): Promise<NotificationResult> {
      try {
        const { resendApiKey, emailTo, emailFrom } = config;

        if (!resendApiKey || !emailTo) {
          return {
            channel: "email",
            success: false,
            error: "resendApiKey and emailTo required",
            sentAt: new Date().toISOString(),
          };
        }

        const severityColor: Record<string, string> = {
          info: "#3498db",
          success: "#2ecc71",
          warning: "#f39c12",
          error: "#e74c3c",
        };

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <div style="background: #0a0a0a; border-radius: 12px; padding: 24px; border: 1px solid #222;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${severityColor[event.severity] || '#95a5a6'};"></div>
                <span style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${event.severity}</span>
              </div>
              <h2 style="color: #fff; font-size: 18px; margin: 0 0 12px 0;">${event.title}</h2>
              <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">${event.body}</p>
              ${event.projectId ? `<p style="color: #666; font-size: 12px; margin: 0;">Projekt: ${event.projectId}</p>` : ""}
              <p style="color: #444; font-size: 11px; margin: 16px 0 0 0;">
                ${new Date(event.timestamp).toLocaleString("hr-HR")} • Straxor AI
              </p>
            </div>
          </div>
        `;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: emailFrom || "Straxor <notifications@straxor.dev>",
            to: [emailTo],
            subject: `[Straxor] ${event.title}`,
            html,
          }),
        });

        if (!res.ok) {
          const data = await res.json() as { message?: string };
          throw new Error(data.message || `Resend API returned ${res.status}`);
        }

        return {
          channel: "email",
          success: true,
          sentAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          channel: "email",
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
          sentAt: new Date().toISOString(),
        };
      }
    },
  };
}
