// ── Local Preview Reverse Proxy ──
// Lets the browser reach a dev server spawned inside the same process — the
// whole point of Iteration 3 was that the preview must work in production on
// Render, where the user's browser obviously cannot reach the server's own
// localhost. The Straxor server proxies
//
//   /api/preview/proxy/<previewKey>/<path...>
//
//   → http://127.0.0.1:<detectedPort>/<path...>
//
// Auth: a short-lived httpOnly cookie scoped to /api/preview/proxy, signed
// with JWT_SECRET and bound to the preview key. Because the iframe is
// same-origin, the cookie travels with EVERY sub-request (JS/CSS assets, the
// HMR websocket), which a query-string token cannot do — the previewed app's
// relative fetches would never carry it.
//
// The proxy handler is mounted in index.ts BEFORE express.json() so request
// bodies stream through untouched, and before the /api rate limiter so a
// real app's asset requests are not throttled.

import http from "http";
import type { IncomingMessage, ServerResponse } from "http";
import type { Duplex } from "stream";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../middleware/auth.js";
import { getPreviewInfo } from "./preview.js";

const COOKIE_NAME = "straxor_preview";
export const PROXY_MOUNT = "/api/preview/proxy";
const PREVIEW_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24h — previews are short-lived anyway

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export interface ParsedProxyUrl {
  key: string;
  path: string;
  query: string;
}

/**
 * Parse a proxy request URL. Accepts both the full path
 * (`/api/preview/proxy/<key>/<rest>`, used by the raw http server / upgrade
 * handler) and the Express-mounted form (`/<key>/<rest>`, i.e. req.url after
 * the router strips the mount prefix). A path that still begins with /api/
 * but is not the proxy prefix is rejected.
 */
export function parseProxyUrl(rawUrl: string): ParsedProxyUrl | null {
  const qIndex = rawUrl.indexOf("?");
  const pathPart = qIndex >= 0 ? rawUrl.slice(0, qIndex) : rawUrl;
  const query = qIndex >= 0 ? rawUrl.slice(qIndex + 1) : "";
  if (!pathPart) return null;

  const full = pathPart.match(/^\/api\/preview\/proxy\/([^/]+)(?:\/(.*))?$/);
  const matched = full ? full : pathPart.match(/^\/([^/]+)(?:\/(.*))?$/);
  if (!matched) return null;
  // Mounted form only: a path still starting with /api/ that is not the
  // proxy prefix is NOT a proxy request.
  if (!full && pathPart.startsWith("/api/")) return null;

  let key = "";
  try {
    key = decodeURIComponent(matched[1]);
  } catch {
    return null;
  }
  if (!key) return null;
  return { key, path: matched[2] || "", query };
}

export function signPreviewToken(key: string): string {
  return jwt.sign({ key }, JWT_SECRET, { expiresIn: `${PREVIEW_TOKEN_TTL_SECONDS}s` });
}

export function verifyPreviewToken(token: string, key: string): boolean {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { key?: string };
    return payload.key === key;
  } catch {
    return false;
  }
}

/** Same-origin URL the iframe should load. No token in the query string. */
export function buildPreviewUrl(key: string): string {
  return `${PROXY_MOUNT}/${encodeURIComponent(key)}`;
}

/** Set the httpOnly preview cookie on a response (path-scoped to the proxy). */
export function issuePreviewCookie(res: ServerResponse, key: string): void {
  const token = signPreviewToken(key);
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=${PROXY_MOUNT}; HttpOnly; SameSite=Lax; Max-Age=${PREVIEW_TOKEN_TTL_SECONDS}`,
  );
}

function readPreviewCookie(req: IncomingMessage): string | null {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0 && part.slice(0, idx).trim() === COOKIE_NAME) {
      return part.slice(idx + 1).trim();
    }
  }
  return null;
}

function stripHopByHop(headers: http.IncomingHttpHeaders, keepUpgrade = false): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined) continue;
    const lk = k.toLowerCase();
    if (HOP_BY_HOP.has(lk)) {
      if (keepUpgrade && (lk === "upgrade" || lk === "connection")) out[k] = v;
      continue;
    }
    out[k] = v;
  }
  return out;
}

function resolveTargetPort(key: string): number | null {
  const info = getPreviewInfo(key);
  if (!info || info.state !== "running" || !info.port) return null;
  return info.port;
}

function targetPath(parsed: ParsedProxyUrl): string {
  return `/${parsed.path}${parsed.query ? `?${parsed.query}` : ""}`;
}

function forwardHttp(req: IncomingMessage, res: ServerResponse, key: string, parsed: ParsedProxyUrl): void {
  const port = resolveTargetPort(key);
  if (!port) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Preview nije aktivan" }));
    return;
  }

  const proxyReq = http.request(
    {
      host: "127.0.0.1",
      port,
      path: targetPath(parsed),
      method: req.method,
      headers: { ...stripHopByHop(req.headers), host: `localhost:${port}` },
    },
    (proxyRes) => {
      const outHeaders = stripHopByHop(proxyRes.headers);
      // Rewrite absolute Location/Content-Location headers that point back at
      // the dev server (e.g. Express redirects) to the proxy URL so redirects
      // stay inside the same origin instead of breaking out to localhost.
      for (const h of ["location", "content-location"]) {
        const v = outHeaders[h];
        if (typeof v === "string" && v.includes(`:${port}`)) {
          outHeaders[h] = v.replace(/https?:\/\/[^/]+/g, buildPreviewUrl(key));
        }
      }
      res.writeHead(proxyRes.statusCode || 502, outHeaders);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ error: "Preview nije dostupan" }));
  });

  req.pipe(proxyReq);
}

/**
 * Express/http-server request handler for the proxy mount. Can be used both as
 * an Express middleware (`app.use(PROXY_MOUNT, handler)`) and as a raw
 * `http.createServer(handler)` listener (tests).
 */
export function createPreviewProxyHandler(): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const parsed = parseProxyUrl(req.url || "");
    if (!parsed) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Nepoznata preview ruta" }));
      return;
    }
    const token = readPreviewCookie(req);
    if (!token || !verifyPreviewToken(token, parsed.key)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Preview zahtijeva autentifikaciju" }));
      return;
    }
    forwardHttp(req, res, parsed.key, parsed);
  };
}

/**
 * WebSocket upgrade handler (Vite/CRA HMR). Attach to the http server:
 * `server.on("upgrade", createPreviewUpgradeHandler())`.
 */
export function createPreviewUpgradeHandler(): (req: IncomingMessage, socket: Duplex, head: Buffer) => void {
  return (req, socket, head) => {
    const parsed = parseProxyUrl(req.url || "");
    const token = readPreviewCookie(req);
    if (!parsed || !token || !verifyPreviewToken(token, parsed.key)) {
      socket.destroy();
      return;
    }
    const port = resolveTargetPort(parsed.key);
    if (!port) {
      socket.destroy();
      return;
    }

    const proxyReq = http.request({
      host: "127.0.0.1",
      port,
      path: targetPath(parsed),
      headers: {
        ...stripHopByHop(req.headers),
        host: `localhost:${port}`,
        connection: "Upgrade",
        upgrade: req.headers.upgrade || "websocket",
      },
    });

    proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
      const outHeaders = stripHopByHop(proxyRes.headers, true);
      let headBuf = "HTTP/1.1 101 Switching Protocols\r\n";
      for (const [k, v] of Object.entries(outHeaders)) {
        if (v === undefined) continue;
        if (Array.isArray(v)) {
          for (const item of v) headBuf += `${k}: ${item}\r\n`;
        } else {
          headBuf += `${k}: ${v}\r\n`;
        }
      }
      headBuf += "\r\n";
      socket.write(headBuf);
      if (proxyHead && proxyHead.length) socket.write(proxyHead);
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
    });

    proxyReq.on("error", () => socket.destroy());
    proxyReq.end();
  };
}
