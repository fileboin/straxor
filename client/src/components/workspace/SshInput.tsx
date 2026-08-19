import { useState } from "react";
import { api } from "../../lib/api.js";

interface Props {
  projectId?: string;
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

// Uklanja sve markdown i shell specijalne znakove, ostavlja samo čist host/IP/user string.
function sanitizeField(value: string): string {
  return value
    .replace(/[`*_~\[\]()#>\\]/g, "") // markdown chars
    .replace(/^["']+|["']+$/g, "")      // leading/trailing quotes
    .trim();
}

interface SshDiagnostic {
  received: { hostRaw: string; portRaw: string; usernameRaw: string; authType: string; hasPassword: boolean };
  parsed: { host: string; port: number; username: string; authType: string };
  sshResult: string;
  sshDetail: string;
  sshError: string;
}

export default function SshInput({ onConnected, onCancel, onStatusChange }: Props) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("root");
  const [authType, setAuthType] = useState<"password" | "key">("password");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [machineName, setMachineName] = useState("");
  const [status, setStatus] = useState<ProvisionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<SshDiagnostic | null>(null);

  // Čisti vrednosti polja — bez ikakve logike parsiranja
  const cleanHost = sanitizeField(host);
  const cleanPort = parseInt(sanitizeField(port), 10);
  const cleanUsername = sanitizeField(username);
  const portValid = Number.isFinite(cleanPort) && cleanPort > 0 && cleanPort <= 65535;
  const hostValid = !!cleanHost && cleanHost !== "localhost" && cleanHost !== "127.0.0.1";
  const canSubmit = hostValid && portValid && !!cleanUsername && (authType === "key" ? !!privateKey.trim() : !!password.trim());

const handleTestSsh = async () => {
    if (!canSubmit) { setError("Popuni sva polja ispravno."); return; }
    setTestLoading(true);
    setDiagnostic(null);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/machines/test-ssh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          host: cleanHost,
          port: cleanPort,
          username: cleanUsername,
          authType,
          password: authType === "password" ? password.trim() : undefined,
          privateKey: authType === "key" ? privateKey.trim() : undefined,
        }),
      });
      const data = await res.json() as SshDiagnostic;
      setDiagnostic(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test nije uspio");
    } finally {
      setTestLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!canSubmit) { setError("Popuni sva polja ispravno."); return; }
    setError("");
    setStatus("connecting");
    setStatusMessage("Spajanje na VPS...");
    onStatusChange?.("connecting");
    setDiagnostic(null);

    try {
      const machine = await api<{ id: string }>("/machines", {
        method: "POST",
        body: JSON.stringify({
          // projectId se namerno ne salje — VPS masine su globalne za korisnika
          name: machineName.trim() || `${cleanUsername}@${cleanHost}`,
          host: cleanHost,
          port: cleanPort,
          username: cleanUsername,
          authType,
          password: authType === "password" ? password.trim() : undefined,
          privateKey: authType === "key" ? privateKey.trim() : undefined,
        }),
      });
      const machineId = machine.id;

      const token = localStorage.getItem("token");
      const response = await fetch(`/api/machines/${machineId}/provision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const text = await response.text();
        let msg = `HTTP ${response.status}`;
        try { msg = (JSON.parse(text) as { error?: string }).error || text; } catch { msg = text || msg; }
        throw new Error(msg);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("SSE konekcija nije dostupna");

      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") { done = true; break; }

          try {
            const event = JSON.parse(data) as { status: ProvisionStatus; message: string };
            setStatus(event.status);
            setStatusMessage(event.message || STATUS_LABELS[event.status] || "");

            if (event.status === "ready") {
              onStatusChange?.("ready");
              onConnected(machineId!);
              return;
            }
            if (event.status === "error") {
              onStatusChange?.("error");
              setError(event.message || "Provisioning nije uspio");
              setStatus("error");
              return;
            }
            if (["checking-os", "checking-node", "starting-opencode"].includes(event.status)) {
              onStatusChange?.("provisioning");
            }
          } catch { /* ignoriši malformed SSE */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Greška";
      onStatusChange?.("error");
      setError(msg);
      setStatus("error");
      setStatusMessage(msg);
    }
  };

  // Prikaz toka (connecting / checking / ready / error)
  if (status !== "idle") {
    return (
      <div className="p-4 border border-border rounded-xl bg-surface space-y-3">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full shrink-0 ${
            status === "ready" ? "bg-green-500" :
            status === "error" ? "bg-red-500" :
            "bg-accent animate-pulse"
          }`} />
          <span className="text-sm font-medium">{STATUS_LABELS[status]}</span>
        </div>
        {statusMessage && (
          <div className="text-xs text-text-muted font-mono bg-surface-2 p-2 rounded-lg break-all">
            {statusMessage}
          </div>
        )}
        {error && <div className="text-xs text-red-400 break-all">{error}</div>}
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
              onClick={() => {
                onStatusChange?.("disconnected");
                onCancel();
              }}
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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">SSH / VPS konekcija</h3>
        <button onClick={onCancel} className="text-text-muted hover:text-text text-xs transition-colors">✕</button>
      </div>

      {/* Naziv */}
      <div>
        <label className="block text-[11px] text-text-muted mb-1">Naziv (opcionalno)</label>
        <input type="text" value={machineName} onChange={(e) => setMachineName(e.target.value)}
          placeholder="Moj VPS"
          className="w-full px-2.5 py-1.5 text-[12px] rounded-lg border border-border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors" />
      </div>

      {/* Host + Port */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[11px] text-text-muted mb-1">Host / IP adresa</label>
          <input type="text" value={host} onChange={(e) => setHost(e.target.value)}
            placeholder="91.99.126.64"
            className={`w-full px-2.5 py-1.5 text-[12px] rounded-lg border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors ${host && !hostValid ? "border-red-500/60" : "border-border"}`} />
          <div className="mt-1 text-[10px] text-text-muted">Samo IP adresa ili hostname. Bez <code>ssh</code>, bez <code>root@</code>.</div>
        </div>
        <div className="w-20 shrink-0">
          <label className="block text-[11px] text-text-muted mb-1">Port</label>
          <input type="text" value={port} onChange={(e) => setPort(e.target.value)}
            placeholder="22"
            className="w-full px-2.5 py-1.5 text-[12px] rounded-lg border border-border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors" />
        </div>
      </div>

      {/* Username */}
      <div>
        <label className="block text-[11px] text-text-muted mb-1">Korisničko ime</label>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
          placeholder="root"
          className="w-full px-2.5 py-1.5 text-[12px] rounded-lg border border-border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors" />
      </div>

      {/* Auth type */}
      <div>
        <label className="block text-[11px] text-text-muted mb-1">Autentikacija</label>
        <div className="flex gap-1">
          {(["password", "key"] as const).map((type) => (
            <button key={type} type="button" onClick={() => setAuthType(type)}
              className={`flex-1 px-2 py-1.5 text-[11px] rounded-lg border transition-colors ${
                authType === type ? "border-accent bg-accent-dim text-accent" : "border-border bg-surface-3 text-text-muted hover:text-text-secondary"
              }`}>
              {type === "password" ? "Lozinka" : "SSH Key"}
            </button>
          ))}
        </div>
      </div>

      {/* Password / Key */}
      {authType === "password" ? (
        <div>
          <label className="block text-[11px] text-text-muted mb-1">Lozinka</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-2.5 py-1.5 text-[12px] rounded-lg border border-border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors font-mono" />
        </div>
      ) : (
        <div>
          <label className="block text-[11px] text-text-muted mb-1">Private Key</label>
          <textarea value={privateKey} onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            rows={5}
            className="w-full px-2.5 py-1.5 text-[11px] rounded-lg border border-border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors font-mono resize-none" />
        </div>
      )}

      {error && <div className="text-xs text-red-400 break-all">{error}</div>}

      {/* Dijagnostički panel */}
      {diagnostic && (
        <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2 text-[11px] font-mono overflow-x-auto">
          <div className={`font-semibold text-[12px] ${diagnostic.sshResult === "success" ? "text-green-400" : "text-red-400"}`}>
            {diagnostic.sshResult === "success" ? "✅ SSH test uspješan" : "❌ SSH test neuspješan"}
          </div>
          <div className="space-y-1">
            <div className="text-text-muted text-[10px] uppercase tracking-wider">Primljeno na serveru (raw):</div>
            <div className="bg-surface-3 rounded p-2 space-y-0.5">
              <div><span className="text-accent">host: </span><span className="text-text">{JSON.stringify(diagnostic.received.hostRaw)}</span></div>
              <div><span className="text-accent">port: </span><span className="text-text">{JSON.stringify(diagnostic.received.portRaw)}</span></div>
              <div><span className="text-accent">user: </span><span className="text-text">{JSON.stringify(diagnostic.received.usernameRaw)}</span></div>
              <div><span className="text-accent">hasPassword: </span><span className="text-text">{String(diagnostic.received.hasPassword)}</span></div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-text-muted text-[10px] uppercase tracking-wider">Posle sanitizacije:</div>
            <div className="bg-surface-3 rounded p-2 space-y-0.5">
              <div><span className="text-accent">host: </span><span className="text-text">{JSON.stringify(diagnostic.parsed.host)}</span></div>
              <div><span className="text-accent">port: </span><span className="text-text">{diagnostic.parsed.port}</span></div>
              <div><span className="text-accent">user: </span><span className="text-text">{JSON.stringify(diagnostic.parsed.username)}</span></div>
            </div>
          </div>
          {(diagnostic.sshDetail || diagnostic.sshError) && (
            <div className="space-y-1">
              <div className="text-text-muted text-[10px] uppercase tracking-wider">SSH rezultat:</div>
              <div className="bg-surface-3 rounded p-2">
                {diagnostic.sshDetail && <div className="text-green-400 break-all">{diagnostic.sshDetail}</div>}
                {diagnostic.sshError && <div className="text-red-400 break-all">{diagnostic.sshError}</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dugmad */}
      <div className="flex gap-2">
        <button type="button" onClick={handleConnect}
          disabled={!canSubmit}
          className="flex-1 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:opacity-85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Poveži i pokreni
        </button>
      </div>
    </div>
  );
}
