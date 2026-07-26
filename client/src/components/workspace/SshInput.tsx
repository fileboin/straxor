import { useState } from "react";
import { api } from "../../lib/api.js";

interface Props {
  projectId: string;
  onConnected: (machineId: string) => void;
  onCancel: () => void;
}

export type ProvisionStatus =
  | "idle"
  | "connecting"
  | "checking-os"
  | "checking-node"
  | "installing-node"
  | "starting-opencode"
  | "ready"
  | "error";

const STATUS_LABELS: Record<ProvisionStatus, string> = {
  idle: "",
  connecting: "Spajanje na VPS...",
  "checking-os": "Detekcija operativnog sustava...",
  "checking-node": "Provjera Node.js...",
  "installing-node": "Instalacija Node.js...",
  "starting-opencode": "Pokretanje opencode serve...",
  ready: "Spremno!",
  error: "Greška",
};

export default function SshInput({ projectId, onConnected, onCancel }: Props) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [authType, setAuthType] = useState<"password" | "key">("password");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [machineName, setMachineName] = useState("");
  const [status, setStatus] = useState<ProvisionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [connectedMachineId, setConnectedMachineId] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!host || !username || (!password && authType === "password") || (!privateKey && authType === "key")) {
      setError("Popuni sva obavezna polja");
      return;
    }

    setError("");
    setStatus("connecting");

    try {
      // Save machine to DB
      const machine = await api<{ id: string }>("/machines", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          name: machineName || `${username}@${host}`,
          host,
          port: parseInt(port, 10),
          username,
          authType,
          password: authType === "password" ? password : undefined,
          privateKey: authType === "key" ? privateKey : undefined,
        }),
      });

      // Start provisioning via SSE
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/machines/${machine.id}/provision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      const reader = response.body?.getReader();
      if (!reader) {
        setError("Greška pri povezivanju");
        setStatus("idle");
        return;
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
            break;
          }

          try {
            const event = JSON.parse(data);
            setStatus(event.status);
            setStatusMessage(event.message);

            if (event.status === "ready") {
              setConnectedMachineId(machine.id);
              return;
            }
            if (event.status === "error") {
              setError(event.message);
              return;
            }
          } catch {}
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Greška";
      setError(message);
      setStatus("idle");
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
        {status === "ready" && (
          <button
            onClick={() => onConnected(connectedMachineId || "")}
            className="w-full py-2 text-sm font-medium rounded-lg bg-accent text-white hover:opacity-85 transition-colors"
          >
            Nastavi
          </button>
        )}
        {status === "error" && (
          <button
            onClick={() => {
              setStatus("idle");
              setError("");
            }}
            className="w-full py-2 text-sm font-medium rounded-lg border border-border bg-surface-2 text-text-secondary hover:text-text transition-colors"
          >
            Pokušaj ponovo
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 border border-border rounded-xl bg-surface space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Poveži VPS</h3>
        <button
          onClick={onCancel}
          className="text-text-muted hover:text-text text-xs transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Machine name */}
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

      {/* Host + Port */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[11px] text-text-muted mb-1">Host / IP</label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="192.168.1.100"
            className="w-full px-2.5 py-1.5 text-[12px] rounded-lg border border-border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors"
          />
        </div>
        <div className="w-20">
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

      {/* Username */}
      <div>
        <label className="block text-[11px] text-text-muted mb-1">Korisničko ime</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="root"
          className="w-full px-2.5 py-1.5 text-[12px] rounded-lg border border-border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Auth type toggle */}
      <div>
        <label className="block text-[11px] text-text-muted mb-1">Autentikacija</label>
        <div className="flex gap-1">
          <button
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

      {/* Password or Private Key */}
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
            rows={4}
            className="w-full px-2.5 py-1.5 text-[11px] rounded-lg border border-border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors font-mono resize-none"
          />
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400">{error}</div>
      )}

      <button
        onClick={handleConnect}
        disabled={!host || !username}
        className="w-full py-2 text-sm font-medium rounded-lg bg-accent text-white hover:opacity-85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Poveži i pokreni
      </button>
    </div>
  );
}
