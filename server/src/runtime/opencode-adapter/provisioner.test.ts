import { describe, expect, it, vi } from "vitest";
import {
  listOllamaModelsOnVps,
  detectOllamaOnVps,
  configureOpenCodeForOllama,
  startOpenCodeServe,
} from "./provisioner.js";
import type { SSHClient } from "./ssh.js";

function fakeSsh(responses: Record<string, { stdout?: string; stderr?: string; code?: number }>): SSHClient {
  return {
    client: {} as any,
    async exec(command: string) {
      for (const [pattern, res] of Object.entries(responses)) {
        if (command.includes(pattern)) {
          return { stdout: res.stdout ?? "", stderr: res.stderr ?? "", code: res.code ?? 0 };
        }
      }
      return { stdout: "", stderr: "", code: 0 };
    },
    async execStream() {
      throw new Error("not used");
    },
    close() {},
  } as SSHClient;
}

describe("VPS-Ollama provisioning (direct OpenCode→Ollama)", () => {
  it("listOllamaModelsOnVps parses /api/tags and drops embed models", async () => {
    const ssh = fakeSsh({
      "/api/tags": {
        stdout: JSON.stringify({
          models: [
            { name: "deepseek-coder:6.7b" },
            { name: "nomic-embed-text" },
            { name: "qwen2.5-coder:7b", size: 123 },
          ],
        }),
      },
    });
    const models = await listOllamaModelsOnVps(ssh);
    expect(models.map((m) => m.name)).toEqual(["deepseek-coder:6.7b", "qwen2.5-coder:7b"]);
  });

  it("listOllamaModelsOnVps returns [] on empty/garbage output", async () => {
    const ssh = fakeSsh({ "/api/tags": { stdout: "" } });
    expect(await listOllamaModelsOnVps(ssh)).toEqual([]);
  });

  it("detectOllamaOnVps reports alive with a coding model", async () => {
    const ssh = fakeSsh({
      "/api/tags": {
        stdout: JSON.stringify({ models: [{ name: "qwen2.5-coder:7b" }, { name: "llama3.1:8b" }] }),
      },
    });
    const status = await detectOllamaOnVps(ssh);
    expect(status.alive).toBe(true);
    expect(status.modelCount).toBe(2);
    expect(status.codingModel).toBe("qwen2.5-coder:7b");
    expect(status.models).toContain("llama3.1:8b");
  });

  it("detectOllamaOnVps reports reachable-but-empty when no models installed", async () => {
    const ssh = fakeSsh({
      "/api/tags": { stdout: JSON.stringify({ models: [] }) },
      "/api/version": { stdout: "v0.1" },
    });
    const status = await detectOllamaOnVps(ssh);
    expect(status.alive).toBe(false);
    expect(status.error).toContain("no models");
  });

  it("detectOllamaOnVps reports unreachable when curl yields nothing", async () => {
    const ssh = fakeSsh({ "/api/tags": { stdout: "" }, "/api/version": { stdout: "" } });
    const status = await detectOllamaOnVps(ssh);
    expect(status.alive).toBe(false);
    expect(status.error).toContain("unreachable");
  });

  it("configureOpenCodeForOllama writes an OpenAI-compatible /v1 baseURL via base64", async () => {
    let written = "";
    const ssh = fakeSsh({
      "base64 -d": {
        code: 0,
        stdout: "",
        stderr: "",
      },
    });
    // Intercept the exec to capture the decoded config.
    const sshProbe: SSHClient = {
      client: {} as any,
      async exec(command: string) {
        if (command.includes("base64 -d")) {
          const b64 = command.match(/echo '([^']+)'/)?.[1] || "";
          written = Buffer.from(b64, "base64").toString("utf8");
          return { stdout: "", stderr: "", code: 0 };
        }
        return { stdout: "", stderr: "", code: 0 };
      },
      async execStream() {
        throw new Error("not used");
      },
      close() {},
    };
    const ok = await configureOpenCodeForOllama(sshProbe, "qwen2.5-coder:7b");
    expect(ok).toBe(true);
    expect(written).toContain('"model": "ollama/qwen2.5-coder:7b"');
    expect(written).toContain('"baseURL": "http://localhost:11434/v1"');
    expect(written).not.toContain("FCC");
  });

  it("configureOpenCodeForOllama returns false when the write fails", async () => {
    const ssh = fakeSsh({ "base64 -d": { code: 1, stderr: "no perm" } });
    expect(await configureOpenCodeForOllama(ssh, "qwen2.5-coder:7b")).toBe(false);
  });

  it("startOpenCodeServe pins the config to the detected Ollama coding model", async () => {
    const execLog: string[] = [];
    let configured = false;
    const ssh: SSHClient = {
      client: {} as any,
      async exec(command: string) {
        execLog.push(command);
        // curl probe returns one coding model
        if (command.includes("/api/tags")) {
          return { stdout: JSON.stringify({ models: [{ name: "qwen2.5-coder:7b" }] }), stderr: "", code: 0 };
        }
        if (command.includes("base64 -d")) {
          configured = true;
          return { stdout: "", stderr: "", code: 0 };
        }
        if (command.includes("command -v opencode")) return { stdout: "/usr/bin/opencode", stderr: "", code: 0 };
        if (command.includes("ss -tlnp")) return { stdout: "", stderr: "", code: 0 };
        if (command.includes("pgrep -f 'opencode serve'")) return { stdout: "12345", stderr: "", code: 0 };
        return { stdout: "", stderr: "", code: 0 };
      },
      async execStream() {
        throw new Error("not used");
      },
      close() {},
    };
    await startOpenCodeServe(ssh, 4096);
    expect(configured).toBe(true);
    expect(execLog.some((c) => c.includes("base64 -d"))).toBe(true);
  }, 15000);

  it("startOpenCodeServe still provisions when Ollama is absent (does not block)", async () => {
    const ssh: SSHClient = {
      client: {} as any,
      async exec(command: string) {
        if (command.includes("/api/tags")) return { stdout: "", stderr: "", code: 0 };
        if (command.includes("/api/version")) return { stdout: "", stderr: "", code: 0 };
        if (command.includes("command -v opencode")) return { stdout: "/usr/bin/opencode", stderr: "", code: 0 };
        if (command.includes("ss -tlnp")) return { stdout: "", stderr: "", code: 0 };
        if (command.includes("pgrep -f 'opencode serve'")) return { stdout: "12345", stderr: "", code: 0 };
        return { stdout: "", stderr: "", code: 0 };
      },
      async execStream() {
        throw new Error("not used");
      },
      close() {},
    };
    await expect(startOpenCodeServe(ssh, 4096)).resolves.toBeUndefined();
  }, 15000);
});