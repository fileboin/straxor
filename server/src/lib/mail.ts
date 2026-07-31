// ── Email helper ──
// Sends email via Resend API when RESEND_API_KEY is set,
// otherwise falls back to console logging (dev mode).

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({ to, subject, html, from }: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const sender = from || process.env.EMAIL_FROM || "Straxor <notifications@straxor.dev>";

  if (!apiKey) {
    console.log(`[mail:dev] → ${to}\nSubject: ${subject}\n${html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}\n`);
    return true;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const data = await res.json() as { message?: string };
      throw new Error(data.message || `Resend API returned ${res.status}`);
    }
    return true;
  } catch (err) {
    console.error("[mail] Failed to send:", err instanceof Error ? err.message : err);
    return false;
  }
}

export function buildAppUrl(req: { protocol: string; get: (name: string) => string | undefined }): string {
  const host = req.get("host") || "localhost:5173";
  return `${req.protocol}://${host}`;
}
