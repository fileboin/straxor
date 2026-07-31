import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq, or, count } from "drizzle-orm";
import { sendEmail, buildAppUrl } from "../lib/mail.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Admin role resolution ──
// ADMIN_EMAIL (comma-separated) always has admin access as a failsafe.
// Otherwise the very first registered user is bootstrapped as admin; every
// subsequent user defaults to the regular "user" role.

export function isAdminEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
    .includes(e);
}

export async function resolveRoleForEmail(email: string): Promise<string> {
  if (isAdminEmail(email)) return "admin";
  const rows = await db
    .select({ total: count() })
    .from(users)
    .where(or(eq(users.role, "admin"), eq(users.role, "super_admin")));
  if ((rows[0]?.total ?? 0) === 0) return "admin"; // bootstrap first user
  return "user";
}

interface PublicUser {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
}

function toPublicUser(u: {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean | null;
}): PublicUser {
  return { id: u.id, email: u.email, role: u.role, emailVerified: !!u.emailVerified };
}

async function publicUserWithFailsafe(user: {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean | null;
}): Promise<PublicUser> {
  if (isAdminEmail(user.email) && user.role !== "admin") {
    await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
    return { ...toPublicUser(user), role: "admin" };
  }
  return toPublicUser(user);
}

function signToken(user: PublicUser): string {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

function verificationEmailHtml(link: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <div style="background: #0a0a0a; border-radius: 12px; padding: 24px; border: 1px solid #222;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: #6b8c42;"></div>
          <span style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Email verifikacija</span>
        </div>
        <h2 style="color: #fff; font-size: 18px; margin: 0 0 12px 0;">Potvrdite svoju email adresu</h2>
        <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
          Kliknite na dugme ispod da potvrdite svoju email adresu i aktivirate svoj Straxor račun.
        </p>
        <a href="${link}" style="display: inline-block; background: #6b8c42; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">
          Potvrdi email
        </a>
        <p style="color: #666; font-size: 12px; margin: 16px 0 0 0;">Ako dugme ne radi, kopirajte link: ${link}</p>
      </div>
    </div>
  `;
}

function resetPasswordEmailHtml(link: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <div style="background: #0a0a0a; border-radius: 12px; padding: 24px; border: 1px solid #222;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: #f39c12;"></div>
          <span style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Reset lozinke</span>
        </div>
        <h2 style="color: #fff; font-size: 18px; margin: 0 0 12px 0;">Postavite novu lozinku</h2>
        <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
          Primili ste zahtjev za promjenu lozinke. Kliknite na dugme ispod da postavite novu lozinku.
          Ovaj link važi 1 sat.
        </p>
        <a href="${link}" style="display: inline-block; background: #6b8c42; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">
          Resetuj lozinku
        </a>
        <p style="color: #666; font-size: 12px; margin: 16px 0 0 0;">Ako dugme ne radi, kopirajte link: ${link}</p>
        <p style="color: #444; font-size: 11px; margin: 16px 0 0 0;">Ako niste tražili promjenu lozinke, možete zanemariti ovaj email.</p>
      </div>
    </div>
  `;
}

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email i lozinka su obavezni" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Lozinka mora imati najmanje 6 karaktera" });
    }

    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email već postoji" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = randomBytes(32).toString("hex");
    const role = await resolveRoleForEmail(email);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, verificationToken, role })
      .returning({ id: users.id, email: users.email, role: users.role, emailVerified: users.emailVerified });

    const appUrl = buildAppUrl(req);
    const verifyLink = `${appUrl}/verify-email?token=${verificationToken}`;
    await sendEmail({
      to: email,
      subject: "Potvrdite svoju email adresu — Straxor",
      html: verificationEmailHtml(verifyLink),
    });

    const publicUser = toPublicUser(user);
    const token = signToken(publicUser);

    res.status(201).json({ user: publicUser, token });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Greška pri registraciji" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email i lozinka su obavezni" });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      return res.status(401).json({ error: "Neispravni podaci" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Neispravni podaci" });
    }

    const publicUser = await publicUserWithFailsafe(user);
    const token = signToken(publicUser);

    res.json({ user: publicUser, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Greška pri prijavi" });
  }
});

// POST /auth/verify-email — confirm email address via token
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Nedostaje token" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.verificationToken, token));

    if (!user) {
      return res.status(400).json({ error: "Neispravan ili istekao token" });
    }

    await db
      .update(users)
      .set({ emailVerified: true, verificationToken: null })
      .where(eq(users.id, user.id));

    res.json({ ok: true, message: "Email potvrđen" });
  } catch (err) {
    console.error("Verify email error:", err);
    res.status(500).json({ error: "Greška pri verifikaciji emaila" });
  }
});

// POST /auth/resend-verification — resend verification email
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email je obavezan" });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user || user.emailVerified) {
      return res.json({ ok: true, message: "Ako račun postoji i nije verifikovan, poslat je email." });
    }

    const verificationToken = randomBytes(32).toString("hex");
    await db
      .update(users)
      .set({ verificationToken })
      .where(eq(users.id, user.id));

    const appUrl = buildAppUrl(req);
    const verifyLink = `${appUrl}/verify-email?token=${verificationToken}`;
    await sendEmail({
      to: email,
      subject: "Potvrdite svoju email adresu — Straxor",
      html: verificationEmailHtml(verifyLink),
    });

    res.json({ ok: true, message: "Verifikacioni email poslat." });
  } catch (err) {
    console.error("Resend verification error:", err);
    res.status(500).json({ error: "Greška pri slanju emaila" });
  }
});

// POST /auth/forgot-password — send password reset link
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email je obavezan" });
    }

    // Always respond success to avoid user enumeration
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (user) {
      const resetToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await db
        .update(users)
        .set({ resetToken, resetTokenExpires: expiresAt })
        .where(eq(users.id, user.id));

      const appUrl = buildAppUrl(req);
      const resetLink = `${appUrl}/reset-password?token=${resetToken}`;
      await sendEmail({
        to: email,
        subject: "Reset lozinke — Straxor",
        html: resetPasswordEmailHtml(resetLink),
      });
    }

    res.json({ ok: true, message: "Ako račun postoji, link za reset lozinke je poslat." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Greška pri slanju emaila" });
  }
});

// POST /auth/reset-password — set new password with token
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: "Token i nova lozinka su obavezni" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Lozinka mora imati najmanje 6 karaktera" });
    }

    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    if (!user) {
      return res.status(400).json({ error: "Neispravan ili istekao token" });
    }

    if (user.resetTokenExpires && new Date(user.resetTokenExpires).getTime() < Date.now()) {
      return res.status(400).json({ error: "Link je istekao. Zatražite novi reset lozinke." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db
      .update(users)
      .set({ passwordHash, resetToken: null, resetTokenExpires: null })
      .where(eq(users.id, user.id));

    res.json({ ok: true, message: "Lozinka uspješno promijenjena" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Greška pri promjeni lozinke" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Nema tokena" });
    }

    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };

    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, payload.userId));

    if (!user) {
      return res.status(401).json({ error: "Korisnik ne postoji" });
    }

    res.json({ user: await publicUserWithFailsafe(user) });
  } catch {
    res.status(401).json({ error: "Neispravan token" });
  }
});

export default router;
