import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      /** Backwards-compat alias: set to user.userId by requireAuth. */
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Nema tokena" });
  }

  try {
    const token = authHeader.split(" ")[1];
    req.user = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.userId = req.user.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Neispravan token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, async () => {
    const tokenUser = req.user;
    if (!tokenUser) {
      return res.status(401).json({ error: "Nema tokena" });
    }

    // Failsafe: re-check the live DB role and ADMIN_EMAIL so admin access
    // survives token-role staleness (e.g. after a promote/demote or when
    // ADMIN_EMAIL was configured after the user first registered).
    const adminEmails = (process.env.ADMIN_EMAIL || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdminEmail = adminEmails.includes(tokenUser.email.toLowerCase());

    let dbRole: string | undefined;
    try {
      const [row] = await db
        .select({ role: users.role, email: users.email })
        .from(users)
        .where(eq(users.id, tokenUser.userId))
        .limit(1);
      dbRole = row?.role;
      if (isAdminEmail && row && row.role !== "admin") {
        await db.update(users).set({ role: "admin" }).where(eq(users.id, tokenUser.userId));
        dbRole = "admin";
      }
    } catch {
      // DB unreachable — fall back to the token role
    }

    const role = dbRole || tokenUser.role;
    if (role !== "admin" && role !== "super_admin" && !isAdminEmail) {
      return res.status(403).json({ error: "Zabranjen pristup — potrebna admin uloga" });
    }

    next();
  });
}
