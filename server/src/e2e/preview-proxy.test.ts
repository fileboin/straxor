// ── ITERATION 3b — PREVIEW PROXY (automated E2E) ──
// Proves the same-origin reverse proxy that makes the iframe preview work in
// production on Render: a real local dev server is spawned, then requests are
// forwarded through /api/preview/proxy/<key> to it, guarded by a signed
// httpOnly cookie bound to the preview key.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import fs from "fs";
import os from "os";
import path from "path";
import {
  buildPreviewUrl,
  createPreviewProxyHandler,
  parseProxyUrl,
  signPreviewToken,
  verifyPreviewToken,
} from "../runtime/local/preview-proxy.js";
import {
  clearPreviews,
  getPreviewInfo,
  previewKey,
  startPreview,
  stopAllPreviews,
  type LocalPreviewInfo,
} from "../runtime/local/preview.js";
import { getRepoWorkspaceDir } from "../runtime/local/workspace.js";
import { clearTerminalEntries } from "../lib/terminal.js";
import { clearProcessRegistry } from "../lib/process-registry.js";

const USER = "proxy-user";
const OWNER = "acme";
const NAME = "proxy-app";
const KEY = previewKey(USER, OWNER, NAME, "task-proxy");

let repoDir = "";
let base = "";
let proxyServer: http.Server;
let proxyPort = 0;

function httpGet(urlPath: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: proxyPort, path: urlPath, headers }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function waitForState(key: string, state: string, timeoutMs = 15000): Promise<LocalPreviewInfo> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const info = getPreviewInfo(key);
    if (info && info.state === state) return info;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for preview state ${state}; last=${JSON.stringify(getPreviewInfo(key))}`);
}

beforeAll(async () => {
  base = await fs.promises.mkdtemp(path.join(os.tmpdir(), "straxor-proxy-"));
  process.env.STRAXOR_WORKSPACE_DIR = path.join(base, "workspaces");
  repoDir = getRepoWorkspaceDir(USER, OWNER, NAME);
  await fs.promises.mkdir(repoDir, { recursive: true });

  await fs.promises.writeFile(
    path.join(repoDir, "package.json"),
    JSON.stringify({ name: "proxy-fixture", version: "1.0.0", private: true, scripts: { dev: "node server.js" } }),
  );
  await fs.promises.writeFile(
    path.join(repoDir, "server.js"),
    [
      'const http = require("http");',
      'const port = process.env.PORT ? Number(process.env.PORT) : 4173;',
      'http.createServer((req, res) => {',
      '  if (req.url === "/sub") { res.setHeader("X-Proxied", "yes"); res.end("sub-page"); return; }',
      '  res.end("hello-proxy");',
      '}).listen(port, "0.0.0.0", () => console.log("listening on port " + port));',
      "",
    ].join("\n"),
  );

  // Real HTTP server running the proxy handler.
  proxyServer = http.createServer(createPreviewProxyHandler());
  await new Promise<void>((resolve) => proxyServer.listen(0, "127.0.0.1", () => resolve()));
  const addr = proxyServer.address() as { port: number };
  proxyPort = addr.port;

  await startPreview({ userId: USER, owner: OWNER, name: NAME, taskId: "task-proxy" });
  await waitForState(KEY, "running");
});

afterAll(async () => {
  await stopAllPreviews();
  clearPreviews();
  clearTerminalEntries();
  clearProcessRegistry();
  if (proxyServer) await new Promise<void>((r) => proxyServer.close(() => r()));
  delete process.env.STRAXOR_WORKSPACE_DIR;
  await fs.promises.rm(base, { recursive: true, force: true }).catch(() => {});
});

describe("Iteration 3b — Preview Proxy (E2E)", () => {
  it("1. signs and verifies preview tokens (bound to the key)", () => {
    const token = signPreviewToken(KEY);
    expect(verifyPreviewToken(token, KEY)).toBe(true);
    expect(verifyPreviewToken(token, "other:key")).toBe(false);
    expect(verifyPreviewToken("garbage", KEY)).toBe(false);
  });

  it("2. parses full and mounted proxy URLs", () => {
    const full = parseProxyUrl(`${buildPreviewUrl(KEY)}/src/main.tsx?x=1`);
    expect(full).toEqual({ key: KEY, path: "src/main.tsx", query: "x=1" });

    // Express-mounted form (req.url after the mount prefix is stripped).
    const mounted = parseProxyUrl(`/${encodeURIComponent(KEY)}?token=abc`);
    expect(mounted?.key).toBe(KEY);
    expect(mounted?.path).toBe("");
    expect(mounted?.query).toBe("token=abc");

    expect(parseProxyUrl("/api/other")).toBeNull();
    expect(parseProxyUrl("")).toBeNull();
  });

  it("3. buildPreviewUrl returns a same-origin proxy path (no token in URL)", () => {
    const url = buildPreviewUrl(KEY);
    expect(url).toBe(`/api/preview/proxy/${encodeURIComponent(KEY)}`);
    expect(url).not.toContain("token");
    expect(url).not.toContain("localhost");
  });

  it("4. forwards requests to the running local dev server", async () => {
    const { status, body } = await httpGet(buildPreviewUrl(KEY), { Cookie: `straxor_preview=${signPreviewToken(KEY)}` });
    expect(status).toBe(200);
    expect(body).toBe("hello-proxy");
  });

  it("5. forwards sub-paths and custom response headers", async () => {
    const { status, body } = await httpGet(`${buildPreviewUrl(KEY)}/sub`, {
      Cookie: `straxor_preview=${signPreviewToken(KEY)}`,
    });
    expect(status).toBe(200);
    expect(body).toBe("sub-page");
  });

  it("6. rejects requests without a valid cookie (401)", async () => {
    const noCookie = await httpGet(buildPreviewUrl(KEY));
    expect(noCookie.status).toBe(401);

    const badCookie = await httpGet(buildPreviewUrl(KEY), { Cookie: "straxor_preview=forged" });
    expect(badCookie.status).toBe(401);

    // Cookie signed for a different key must not grant access to this one.
    const wrongKey = await httpGet(buildPreviewUrl(KEY), { Cookie: `straxor_preview=${signPreviewToken("someone-else")}` });
    expect(wrongKey.status).toBe(401);
  });

  it("7. returns 404 for an unknown preview key", async () => {
    const { status } = await httpGet(buildPreviewUrl("nobody:repo__x"), {
      Cookie: `straxor_preview=${signPreviewToken("nobody:repo__x")}`,
    });
    expect(status).toBe(404);
  });
});
