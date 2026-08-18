import type { NextFunction, Request, Response } from "express";

// Static assets and health pings would drown the log; they're skipped. SSE
// streams are logged exactly once when the response finishes (client
// disconnect or stream end), which also surfaces their total duration.
const SKIP_PREFIXES = ["/assets/", "/uploads/", "/favicon.ico"];
const SKIP_EXACT = new Set(["/api/health", "/api/healthz"]);

export function shouldSkipHttpLog(method: string, path: string): boolean {
  if (method === "OPTIONS") return true;
  if (SKIP_EXACT.has(path)) return true;
  return SKIP_PREFIXES.some((p) => path.startsWith(p));
}

export function formatHttpLog(
  method: string,
  path: string,
  status: number,
  durationMs: number
): string {
  return `[http] ${method} ${path} → ${status} (${durationMs}ms)`;
}

export function httpRequestLogger() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (shouldSkipHttpLog(req.method, req.path)) {
      next();
      return;
    }
    const start = Date.now();
    res.on("finish", () => {
      const line = formatHttpLog(req.method, req.originalUrl, res.statusCode, Date.now() - start);
      if (res.statusCode >= 500) console.error(line);
      else if (res.statusCode >= 400) console.warn(line);
      else console.log(line);
    });
    next();
  };
}
