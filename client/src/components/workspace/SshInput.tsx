import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { listMachines } from "../../lib/machines.js";

interface Props {
  projectId: string;
  onConnected: (machineId: string) => void;
  onCancel: () => void;
  onStatusChange?: (status: "disconnected" | "connecting" | "provisioning" | "ready" | "error") => void;
}

export type ProvisionStatus =
  | "idle"
  | "connecting"
  | "checking-os"
  | "checking-node"
  | "starting-opencode"
  | "ready"
  | "error";

const STATUS_LABELS: Record<ProvisionStatus, string> = {
  idle: "",
  connecting: "Spajanje na VPS...",
  "checking-os": "Detekcija operativnog sustava...",
  "checking-node": "Provjera Node.js...",
  "starting-opencode": "Pokretanje opencode servera...",
  ready: "Spremno!",
  error: "Greška",
};

function stripMarkdown(value: string): string {
  return value
    .replace(/\*+/g, "")     // ** bold, * italic
    .replace(/`+/g, "")      // `` backticks
    .replace(/_+/g, "")      // __ underline
    .replace(/~+/g, "")      // ~~ strikethrough
    .replace(/\[|\]/g, "")   // [ ] brackets
    .replace(/\(|\)/g, "")   // ( ) parens used in markdown links
    .replace(/#+/g, "")      // # headings
    .replace(/>/g, "")       // > blockquote
    .trim();
}

function parseSshTarget(value: string): { host: string; username?: string; port?: number } {
  let raw = stripMarkdown(value).trim();
  if (!raw) return { host: "" };

  raw = raw.replace(/^ssh:\/\//i, "");
  raw = raw.replace(/^ssh\s+/i, "").trim();

  const portFlagMatch = raw.match(/(?:^|\s)-p\s+(\d+)(?:\s|$)/i);
  const portFromFlag = portFlagMatch ? parseInt(portFlagMatch[1], 10) : undefined;
  if (portFlagMatch) {
    raw = raw.replace(portFlagMatch[0], " ").trim();
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  let target = tokens[tokens.length - 1] || raw;
  target = target.replace(/^[`'"]+|[`'"]+$/g, "");
  target = target.replace(/^https?:\/\//i, "").replace(/\/+$/, "");

  let username: string | undefined;
  let hostPort = target;

  const atIndex = target.lastIndexOf("@");
  if (atIndex > 0) {
    username = target.slice(0, atIndex).trim() || undefined;
    hostPort = target.slice(atIndex + 1).trim();
  }

  let host = hostPort;
  let port = portFromFlag;

  const bracketMatch = hostPort.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (bracketMatch) {
    host = bracketMatch[1];
    if (!port && bracketMatch[2]) port = parseInt(bracketMatch[2], 10);
    return { host, username, port };
  }

  const colonCount = (hostPort.match(/:/g) || []).length;
  if (colonCount === 1) {
    const [maybeHost, maybePort] = hostPort.split(":");
    if (/^\d+$/.test(maybePort || "")) {
      host = maybeHost;
      if (!port) port = parseInt(maybePort, 10);
    }
  }

  return { host, username, port };
}

function normalizeHost(value: string): string {
  return parseSshTarget(value).host;
}

function isLikelyPrivateHost(host: string): boolean {
  const normalized = normalizeHost(host).toLowerCase();
  return (
    !normalized ||
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

async function readErrorResponse(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `Zahtjev je vraćen sa statusom ${response.status}`;
  }

  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return parsed.error || parsed.message || text;
  } catch {
    return text;
  }
}

interface SshDiagnostic {
  received: {
    hostRaw: string;
    portRaw: string;
    usernameRaw: string;
    authType: string;
    hasPassword: boolean;
    hasKey: boolean;
  };
  parsed: {
    host: string;
    port: number;
    username: string;
    authType: string;
  };
  sshResult: string;
  sshDetail: string;
  sshError: string;
}

export default function SshInput({ projectId, onConnected, onCancel, onStatusChange }: Props) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("root");
  const [authType, setAuthType] = useState<"password" | "key">("key");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [machineName, setMachineName] = useState("");
  const [status, setStatus] = useState<ProvisionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<SshDiagnostic | null>(null);

  const parsedTarget = useMemo(() => parseSshTarget(host), [host]);
  const normalizedHost = parsedTarget.host;
  const hostLooksInvalid = isLikelyPrivateHost(host);

  useEffect(() => {
    let mounted = true;
    listMachines()
      .then((machines) => {
        if (!mounted || prefilled) return;
        const latest = [...machines]
          .filter((machine) => machine.status === "ready" || machine.status === "connecting" || machine.status === "pending")
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        if (!latest) return;
        setHost((current) => current || latest.host || "");
        setPort((current) => current || String(latest.port || 22));
        setUsername((current) => current || latest.username || "root");
        setAuthType(latest.authType === "password" ? "password" : "key");
        setMachineName((current) => current || latest.name || "");
        setPrefilled(true);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [prefilled]);

  const handleTestSsh = async () => {
    const resolvedUsername = (parsedTarget.username || username).trim();
    const resolvedPort = parsedTarget.port ?? parseInt(port, 10);

    setTestLoading(true);
    setDiagnostic(null);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/machines/test-ssh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          host: normalizedHost || host,
          port: resolvedPort,
          username: resolvedUsername,
          authType,
          password: authType === "password" ? password : undefined,
          privateKey: authType === "key" ? privateKey : undefined,
        }),
      });

      const data = await response.json() as SshDiagnostic;
      setDiagnostic(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test nije uspio");
    } finally {
      setTestLoading(false);
    }
  };

  const handleConnect = async () => {
    const resolvedUsername = (parsedTarget.username || username).trim();
    const resolvedPort = parsedTarget.port ?? parseInt(port, 10);

    if (!normalizedHost || !resolvedUsername || (!password && authType === "password") || (!privateKey && authType === "key")) {
      setError("Unesi javnu VPS IP/DNS adresu, korisničko ime i ispravan SSH/Auth metod.");
      return;
    }

    if (hostLooksInvalid) {
      setError("Unesi javnu VPS IP adresu ili DNS hostname. Lokalne/private adrese nisu validne za VPS povezivanje.");
      return;
    }

    if (!Number.isFinite(resolvedPort) || resolvedPort < 1 || resolvedPort > 65535) {
      setError("SSH port mora biti između 1 i 65535.");
      return;
    }

    setError("");
    setStatus("connecting");
    setStatusMessage("Spajanje na VPS...");
    onStatusChange?.("connecting");

    try {
      const machine = await api<{ id: string }>("/machines", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          name: machineName || `${resolvedUsername}@${normalizedHost}`,
          host: normalizedHost,
          port: resolvedPort,
          username: resolvedUsername,
          authType,
          password: authType === "password" ? password : undefined,
          privateKey: authType === "key" ? privateKey : undefined,
        }),
      });

      const token = localStorage.getItem("token");
      const response = await fetch(`/api/machines/${machine.id}/provision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const message = await readErrorResponse(response);
        throw new Error(message || "Provisioning nije mogao da se pokrene");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("SSE konekcija za provisioning nije dostupna");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            continue;
          }

          try {
            const event = JSON.parse(data) as { status: ProvisionStatus; message: string };
            setStatus(event.status);
            setStatusMessage(event.message || STATUS_LABELS[event.status] || "");

            if (event.status === "ready") {
              onStatusChange?.("ready");
              onConnected(machine.id);
              return;
            }

            if (event.status === "error") {
              onStatusChange?.("error");
              setError(event.message || "Provisioning nije uspio");
              return;
            }

            if (event.status === "checking-os" || event.status === "checking-node" || event.status === "starting-opencode") {
              onStatusChange?.("provisioning");
            }
          } catch {
            // Ignore malformed SSE payloads and continue streaming.
          }
        }
      }

      throw new Error("Provisioning je prekinut prije završetka");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Greška";
      onStatusChange?.("error");
      setError(message);
      setStatus("error");
      setStatusMessage(message);
    }
  };

  if (status !== "idle") {
    return (
      <div className="p-4 border border-border rounded-xl bg-surface">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-3 h-3 rounded-full ${status === "ready" ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-accent animate-pulse"}`} />
          <span className="text-sm font-medium">{STATUS_LABELS[status]}</span>
        </div>
        {statusMessage && (
          <div className="text-xs text-text-muted mb-3 font-mono bg-surface-2 p-2 rounded-lg">
            {statusMessage}
          </div>
        )}
        {error && (
          <div className="text-xs text-red-400 mb-3">{error}</div>
        )}
        {status === "error" && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                onStatusChange?.("disconnected");
                setStatus("idle");
                setStatusMessage("");
                setError("");
              }}
              className="flex-1 py-2 text-sm font-medium rounded-lg border border-border bg-surface-2 text-text-secondary hover:text-text transition-colors"
            >
              Pokušaj ponovo
            </button>
            <button
              onClick={onCancel}
              className="flex-1 py-2 text-sm font-medium rounded-lg border border-border bg-transparent text-text-secondary hover:text-text transition-colors"
            >
              Zatvori
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 border border-border rounded-xl bg-surface space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">SSH / VPS konekcija</h3>
        <button
          onClick={onCancel}
          className="text-text-muted hover:text-text text-xs transition-colors"
        >
          ✕
        </button>
      </div>

      {prefilled && (
        <div className="px-2.5 py-2 rounded-lg border border-green-500/20 bg-green-500/10 text-[11px] text-green-300">
          Forma je automatski popunjena iz poslednje validne VPS mašine.
        </div>
      )}

      <div>
        <label className="block text-[11px] text-text-muted mb-1">Naziv (opcionalno)</label>
        <input
          type="text"
          value={machineName}
          onChange={(e) => setMachineName(e.target.value)}
          placeholder="Moj VPS"
          className="w-full px-2.5 py-1.5 text-[12px] rounded-lg border border-border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[11px] text-text-muted mb-1">Public VPS Host / IP</label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="203.0.113.10, root@203.0.113.10 ili ssh root@203.0.113.10"
            className={`w-full px-2.5 py-1.5 text-[12px] rounded-lg border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors ${host && hostLooksInvalid ? "border-red-500/60" : "border-border"}`}
          />
          <div className="mt-1 text-[10px] text-text-muted">Možeš uneti samo host/IP, `root@host`, ili ceo `ssh root@host` format. Ako uneseš `:port` ili `-p 2222`, i to će biti prepoznato.</div>
        </div>
        <div className="w-20 shrink-0">
          <label className="block text-[11px] text-text-muted mb-1">Port</label>
          <input
            type="text"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="22"
            className="w-full px-2.5 py-1.5 text-[12px] rounded-lg border border-border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] text-text-muted mb-1">Korisničko ime</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="root"
          className="w-full px-2.5 py-1.5 text-[12px] rounded-lg border border-border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors"
        />
        <div className="mt-1 text-[10px] text-text-muted">Ako u host polje uneseš `root@ip` ili `ssh root@ip`, korisničko ime će se automatski preuzeti odatle.</div>
      </div>

      <div>
        <label className="block text-[11px] text-text-muted mb-1">Autentikacija</label>
        <div className="mb-1 text-[10px] text-text-muted">Koristi lozinku ili private key — oba toka sada prolaze kroz isti backend provisioning i istu SSH validaciju.</div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setAuthType("password")}
            className={`flex-1 px-2 py-1.5 text-[11px] rounded-lg border transition-colors ${
              authType === "password"
                ? "border-accent bg-accent-dim text-accent"
                : "border-border bg-surface-3 text-text-muted hover:text-text-secondary"
            }`}
          >
            Lozinka
          </button>
          <button
            type="button"
            onClick={() => setAuthType("key")}
            className={`flex-1 px-2 py-1.5 text-[11px] rounded-lg border transition-colors ${
              authType === "key"
                ? "border-accent bg-accent-dim text-accent"
                : "border-border bg-surface-3 text-text-muted hover:text-text-secondary"
            }`}
          >
            SSH Key
          </button>
        </div>
      </div>

      {authType === "password" ? (
        <div>
          <label className="block text-[11px] text-text-muted mb-1">Lozinka</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-2.5 py-1.5 text-[12px] rounded-lg border border-border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors font-mono"
          />
        </div>
      ) : (
        <div>
          <label className="block text-[11px] text-text-muted mb-1">Private Key</label>
          <textarea
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            rows={5}
            className="w-full px-2.5 py-1.5 text-[11px] rounded-lg border border-border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors font-mono resize-none"
          />
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400">{error}</div>
      )}

      {/* Dijagnostički panel */}
      {diagnostic && (
        <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2 text-[11px] font-mono">
          <div className="font-semibold text-text text-[12px] mb-1">
            {diagnostic.sshResult === "success" ? "✅ SSH test uspješan" : "❌ SSH test neuspješan"}
          </div>

          <div className="text-text-muted">Primljeno (raw):</div>
          <div className="bg-surface-3 rounded p-2 space-y-0.5">
            <div><span className="text-accent">host: </span><span className="text-text">{JSON.stringify(diagnostic.received.hostRaw)}</span></div>
            <div><span className="text-accent">port: </span><span className="text-text">{JSON.stringify(diagnostic.received.portRaw)}</span></div>
            <div><span className="text-accent">user: </span><span className="text-text">{JSON.stringify(diagnostic.received.usernameRaw)}</span></div>
            <div><span className="text-accent">auth: </span><span className="text-text">{diagnostic.received.authType}</span></div>
            <div><span className="text-accent">hasPassword: </span><span className="text-text">{String(diagnostic.received.hasPassword)}</span></div>
          </div>

          <div className="text-text-muted">Posle sanitizacije:</div>
          <div className="bg-surface-3 rounded p-2 space-y-0.5">
            <div><span className="text-accent">host: </span><span className="text-text">{JSON.stringify(diagnostic.parsed.host)}</span></div>
            <div><span className="text-accent">port: </span><span className="text-text">{diagnostic.parsed.port}</span></div>
            <div><span className="text-accent">user: </span><span className="text-text">{JSON.stringify(diagnostic.parsed.username)}</span></div>
          </div>

          <div className="text-text-muted">Rezultat SSH:</div>
          <div className="bg-surface-3 rounded p-2">
            <div><span className="text-accent">status: </span>
              <span className={diagnostic.sshResult === "success" ? "text-green-400" : "text-red-400"}>
                {diagnostic.sshResult}
              </span>
            </div>
            {diagnostic.sshDetail && (
              <div className="mt-1"><span className="text-accent">detail: </span><span className="text-text">{diagnostic.sshDetail}</span></div>
            )}
            {diagnostic.sshError && (
              <div className="mt-1"><span className="text-accent">error: </span><span className="text-red-400">{diagnostic.sshError}</span></div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleTestSsh}
          disabled={testLoading || !normalizedHost || !((parsedTarget.username || username).trim())}
          className="flex-1 py-2 text-sm font-medium rounded-lg border border-border bg-surface-2 text-text-secondary hover:text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {testLoading ? "Testiranje..." : "🔍 Test SSH"}
        </button>
        <button
          type="button"
          onClick={handleConnect}
          disabled={!normalizedHost || !((parsedTarget.username || username).trim()) || hostLooksInvalid}
          className="flex-1 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:opacity-85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Poveži i pokreni
        </button>
      </div>
    </div>
  );
}
