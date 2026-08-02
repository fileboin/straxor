import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { requireAuth } from "./auth.js";
import type { Request, Response } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

function makeReq(headers: Record<string, string | undefined> = {}) {
  return { headers } as unknown as Request;
}
function makeRes() {
  const res = { statusCode: 0, body: undefined } as unknown as Response;
  (res as any).status = (code: number) => {
    (res as any).statusCode = code;
    return res;
  };
  (res as any).json = (body: unknown) => {
    (res as any).body = body;
    return res;
  };
  return res;
}

describe("requireAuth", () => {
  it("sets req.user and req.userId for a valid token", () => {
    const token = jwt.sign(
      { userId: "user-1", email: "a@b.c", role: "admin" },
      JWT_SECRET
    );
    const req = makeReq({ authorization: `Bearer ${token}` });
    let called = false;
    requireAuth(req, makeRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(req.user?.userId).toBe("user-1");
    expect(req.userId).toBe("user-1");
  });

  it("returns 401 when no Authorization header", () => {
    const res = makeRes();
    requireAuth(makeReq({}), res, () => {
      throw new Error("next should not be called");
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 for a malformed token", () => {
    const res = makeRes();
    requireAuth(makeReq({ authorization: "Bearer not-a-token" }), res, () => {
      throw new Error("next should not be called");
    });
    expect(res.statusCode).toBe(401);
  });
});
