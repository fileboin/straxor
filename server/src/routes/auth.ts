import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq, or, count } from "drizzle-orm";
import { sendEmail, buildAppUrl } from "../lib/mail.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const GITHUB_CLIENT_ID = (process.env.GITHUB_CLIENT_ID || "").trim();
const GITHUB_CLIENT_SECRET = (process.env.GITHUB_CLIENT_SECRET || "").trim();
const GITHUB_OAUTH_SCOPE = "read:user user:email";

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

export function isAdminEmailConfigured(): boolean {
  return (process.env.ADMIN_EMAIL || "").trim().length > 0;
}

export async function adminCount(): Promise<number> {
  const rows = await db
    .select({ total: count() })
    .from(users)
    .where(or(eq(users.role, "admin"), eq(users.role, "super_admin")));
  return rows[0]?.total ?? 0;
}

export async function resolveRoleForEmail(email: string): Promise<string> {
  if (isAdminEmail(email)) return "admin";
  const total = await adminCount();
  if (total === 0) return "admin"; // bootstrap first user
  return "user";
}

interface PublicUser {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
  githubLogin?: string | null;
  githubAvatar?: string | null;
}

function toPublicUser(u: {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean | null;
  githubLogin?: string | null;
  githubAvatar?: string | null;
}): PublicUser {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    emailVerified: !!u.emailVerified,
    githubLogin: u.githubLogin || null,
    githubAvatar: u.githubAvatar || null,
  };
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

function oauthStateSecret(): string {
  return process.env.OAUTH_STATE_SECRET || JWT_SECRET;
}

function signOauthState(payload: { nonce: string; returnTo?: string | null }) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHash("sha256").update(`${body}.${oauthStateSecret()}`).digest("base64url");
  return `${body}.${sig}`;
}

function verifyOauthState(raw: string | undefined): { nonce: string; returnTo?: string | null } | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = createHash("sha256").update(`${body}.${oauthStateSecret()}`).digest();
  const actual = Buffer.from(sig, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function buildGithubCallbackUrl(req: Parameters<typeof buildAppUrl>[0]): string {
  const appUrl = buildAppUrl(req).replace(/\/$/, "");
  return `${appUrl}/api/auth/github/callback`;
}

function sanitizeReturnTo(returnTo: unknown): string {
  if (typeof returnTo !== "string" || !returnTo.startsWith("/")) return "/";
  if (returnTo.startsWith("//") || returnTo.startsWith("/api/")) return "/";
  return returnTo;
}

async function exchangeGithubCode(code: string, redirectUri: string) {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "straxor",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const message = data.error_description || data.error || `GitHub OAuth exchange failed (${res.status})`;
    throw new Error(message);
  }
  return String(data.access_token);
}

async function githubApi(path: string, accessToken: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "straxor",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `GitHub API failed (${res.status})`);
  }
  return data;
}

async function resolveGithubEmail(accessToken: string): Promise<string> {
  const profile = await githubApi("/user", accessToken);
  if (profile?.email) return String(profile.email).toLowerCase();
  const emails: any[] = await githubApi("/user/emails", accessToken);
  const primary = emails.find((e) => e?.primary && e?.verified) || emails.find((e) => e?.verified) || emails[0];
  if (!primary?.email) throw new Error("GitHub account nema dostupan email");
  return String(primary.email).toLowerCase();
}

// GitHub profile identity used to durably bind a Straxor user to a GitHub
// account. The GitHub `id` is stable for the lifetime of the account, whereas
// the email can change — so lookups always prefer `githubId` first.
interface GithubProfile {
  id: string;
  login: string;
  avatarUrl?: string;
  email?: string;
}

async function fetchGithubProfile(accessToken: string): Promise<GithubProfile> {
  const profile: any = await githubApi("/user", accessToken);
  return {
    id: String(profile.id),
    login: String(profile.login || ""),
    avatarUrl: typeof profile.avatar_url === "string" ? profile.avatar_url : undefined,
    email: typeof profile.email === "string" ? profile.email.toLowerCase() : undefined,
  };
}

async function findOrCreateGithubUser(profile: GithubProfile, email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  // 1) Durable key: match on the GitHub account id. This survives email changes
  //    and re-binds the user's projects, settings, tokens and chat history.
  if (profile.id) {
    const [byGithubId] = await db.select().from(users).where(eq(users.githubId, profile.id));
    if (byGithubId) {
      const updated = await publicUserWithFailsafe(byGithubId);
      // Rebind login/avatar/email so the record stays in sync.
      await db
        .update(users)
        .set({
          githubLogin: profile.login || byGithubId.githubLogin,
          githubAvatar: profile.avatarUrl || byGithubId.githubAvatar,
          ...(byGithubId.email !== normalizedEmail
            ? { email: normalizedEmail, emailVerified: true }
            : {}),
        })
        .where(eq(users.id, byGithubId.id));
      return updated;
    }
  }

  // 2) Fallback: match on email (used by users who registered before GitHub
  //    identity existed), then bind the GitHub id so future logins are durable.
  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail));
  if (existing) {
    await db
      .update(users)
      .set({
        githubId: profile.id || existing.githubId,
        githubLogin: profile.login || existing.githubLogin,
        githubAvatar: profile.avatarUrl || existing.githubAvatar,
        emailVerified: true,
      })
      .where(eq(users.id, existing.id));
    return publicUserWithFailsafe(existing);
  }

  // 3) New user: create with the GitHub identity attached.
  const role = await resolveRoleForEmail(normalizedEmail);
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  const [user] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      passwordHash,
      role,
      emailVerified: true,
      verificationToken: null,
      githubId: profile.id || null,
      githubLogin: profile.login || null,
      githubAvatar: profile.avatarUrl || null,
    })
    .returning({ id: users.id, email: users.email, role: users.role, emailVerified: users.emailVerified });
  return toPublicUser(user);
}

function verificationEmailHtml(link: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <div style="background: #0a0e1a; border-radius: 12px; padding: 24px; border: 1px solid #202838;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: #ff4d2e;"></div>
          <span style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Email verifikacija</span>
        </div>
        <h2 style="color: #fff; font-size: 18px; margin: 0 0 12px 0;">Potvrdite svoju email adresu</h2>
        <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
          Kliknite na dugme ispod da potvrdite svoju email adresu i aktivirate svoj Straxor račun.
        </p>
        <a href="${link}" style="display: inline-block; background: #ff4d2e; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">
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
      <div style="background: #0a0e1a; border-radius: 12px; padding: 24px; border: 1px solid #202838;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: #f39c12;"></div>
          <span style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Reset lozinke</span>
        </div>
        <h2 style="color: #fff; font-size: 18px; margin: 0 0 12px 0;">Postavite novu lozinku</h2>
        <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
          Primili ste zahtjev za promjenu lozinke. Kliknite na dugme ispod da postavite novu lozinku.
          Ovaj link važi 1 sat.
        </p>
        <a href="${link}" style="display: inline-block; background: #ff4d2e; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">
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

// GET /auth/admin-status — public info used by the Register page to show the
// first-admin bootstrap option. Never leaks emails, only a boolean.
router.get("/admin-status", async (_req, res) => {
  try {
    const total = await adminCount();
    res.json({
      adminExists: total > 0,
      adminEmailConfigured: isAdminEmailConfigured(),
    });
  } catch (err) {
    console.error("Admin status error:", err);
    res.status(500).json({ error: "Greška" });
  }
});

router.get("/github", async (req, res) => {
  try {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return res.status(503).json({ error: "GitHub OAuth nije konfigurisan na serveru" });
    }
    const returnTo = sanitizeReturnTo(req.query.returnTo);
    const nonce = randomBytes(24).toString("hex");
    const state = signOauthState({ nonce, returnTo });
    const redirect = new URL("https://github.com/login/oauth/authorize");
    redirect.searchParams.set("client_id", GITHUB_CLIENT_ID);
    redirect.searchParams.set("redirect_uri", buildGithubCallbackUrl(req));
    redirect.searchParams.set("scope", GITHUB_OAUTH_SCOPE);
    redirect.searchParams.set("state", state);
    res.redirect(302, redirect.toString());
  } catch (err) {
    console.error("GitHub OAuth start error:", err);
    res.status(500).json({ error: "Greška pri pokretanju GitHub prijave" });
  }
});

router.get("/github/callback", async (req, res) => {
  const appUrl = buildAppUrl(req).replace(/\/$/, "");
  const redirectError = (message: string, returnTo = "/login") => {
    const url = new URL(`${appUrl}${sanitizeReturnTo(returnTo)}`);
    url.searchParams.set("oauth", "error");
    url.searchParams.set("message", message);
    res.redirect(302, url.toString());
  };

  try {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      redirectError("GitHub OAuth nije konfigurisan na serveru");
      return;
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const stateRaw = typeof req.query.state === "string" ? req.query.state : undefined;
    const state = verifyOauthState(stateRaw);
    if (!code || !state?.nonce) {
      redirectError("Neispravan GitHub OAuth odgovor");
      return;
    }

    const returnTo = sanitizeReturnTo(state.returnTo || "/");
    const accessToken = await exchangeGithubCode(code, buildGithubCallbackUrl(req));
    const profile = await fetchGithubProfile(accessToken);
    const email = profile.email || (await resolveGithubEmail(accessToken));
    const publicUser = await findOrCreateGithubUser(profile, email);
    const token = signToken(publicUser);

    const url = new URL(`${appUrl}${returnTo}`);
    url.searchParams.set("oauth", "success");
    url.searchParams.set("token", token);
    res.redirect(302, url.toString());
  } catch (err) {
    console.error("GitHub OAuth callback error:", err);
    redirectError(err instanceof Error ? err.message : "GitHub prijava nije uspjela");
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
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        emailVerified: users.emailVerified,
        githubLogin: users.githubLogin,
        githubAvatar: users.githubAvatar,
      })
      .from(users)
      .where(eq(users.id, payload.userId));

    if (!user) {
      return res.status(401).json({ error: "Korisnik ne postoji" });
    }

    const publicUser = await publicUserWithFailsafe(user);
    // Sliding session: every successful `/me` issues a fresh token, so an
    // active user is never logged out while the app keeps the session alive.
    const freshToken = signToken(publicUser);
    res.json({ user: publicUser, token: freshToken });
  } catch {
    res.status(401).json({ error: "Neispravan token" });
  }
});

export default router;
