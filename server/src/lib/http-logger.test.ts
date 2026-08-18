import { describe, it, expect } from "vitest";
import { shouldSkipHttpLog, formatHttpLog } from "./http-logger.js";

describe("shouldSkipHttpLog", () => {
  it("skips OPTIONS preflight", () => {
    expect(shouldSkipHttpLog("OPTIONS", "/api/chat")).toBe(true);
  });

  it("skips health checks", () => {
    expect(shouldSkipHttpLog("GET", "/api/health")).toBe(true);
    expect(shouldSkipHttpLog("GET", "/api/healthz")).toBe(true);
  });

  it("skips static asset and upload paths", () => {
    expect(shouldSkipHttpLog("GET", "/assets/index-abc.js")).toBe(true);
    expect(shouldSkipHttpLog("GET", "/uploads/foo.png")).toBe(true);
    expect(shouldSkipHttpLog("GET", "/favicon.ico")).toBe(true);
  });

  it("logs normal API requests", () => {
    expect(shouldSkipHttpLog("GET", "/api/agent/background/job")).toBe(false);
    expect(shouldSkipHttpLog("POST", "/api/chat")).toBe(false);
    expect(shouldSkipHttpLog("GET", "/")).toBe(false);
  });
});

describe("formatHttpLog", () => {
  it("renders method, path, status and duration", () => {
    expect(formatHttpLog("POST", "/api/chat", 200, 123)).toBe(
      "[http] POST /api/chat → 200 (123ms)"
    );
  });

  it("renders error statuses", () => {
    expect(formatHttpLog("GET", "/api/repos", 500, 42)).toBe(
      "[http] GET /api/repos → 500 (42ms)"
    );
  });
});
