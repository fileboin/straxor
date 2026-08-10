import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { listMachines } from "../../lib/machines.js";

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

function normalizeHost(value: string): string {
  return value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
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

export default function SshInput({ projectId, onConnected, onCancel }: Props) {
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

  const normalizedHost = useMemo(() => normalizeHost(host), [host]);
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

  const handleConnect = async () => {
    if (!normalizedHost || !username.trim() || (!password && authType === "password") || (!privateKey && authType === "key")) {
      setError("Unesi javnu VPS IP/DNS adresu, korisničko ime i ispravan SSH/Auth metod.");
      return;
    }

    if (hostLooksInvalid) {
      setError("Unesi javnu VPS IP adresu ili DNS hostname. Lokalne/private adrese nisu validne za VPS povezivanje.");
      return;
    }

    const parsedPort = parseInt(port, 10);
    if (!Number.isFinite(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      setError("SSH port mora biti između 1 i 65535.");
      return;
    }

    setError("");
    setStatus("connecting");
    setStatusMessage("Spajanje na VPS...");

    try {
      const machine = await api<{ id: string }>("/machines", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          name: machineName || `${username.trim()}@${normalizedHost}`,
          host: normalizedHost,
          port: parsedPort,
          username: username.trim(),
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
              onConnected(machine.id);
              return;
            }

            if (event.status === "error") {
              setError(event.message || "Provisioning nije uspio");
              return;
            }
          } catch {
            // Ignore malformed SSE payloads and continue streaming.
          }
        }
      }

      throw new Error("Provisioning je prekinut prije završetka");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Greška";
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
            placeholder="203.0.113.10 ili vps.example.com"
            className={`w-full px-2.5 py-1.5 text-[12px] rounded-lg border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors ${host && hostLooksInvalid ? "border-red-500/60" : "border-border"}`}
          />
          <div className="mt-1 text-[10px] text-text-muted">Koristi javnu IP adresu VPS-a ili DNS hostname — ne lokalni `192.168.x.x`, `10.x.x.x` ili `localhost`.</div>
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
        <div className="mt-1 text-[10px] text-text-muted">Podrazumevano je `root`. Promeni samo ako tvoj VPS koristi drugog SSH korisnika.</div>
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

      <button
        type="button"
        onClick={handleConnect}
        disabled={!normalizedHost || !username.trim() || hostLooksInvalid}
        className="w-full py-2 text-sm font-medium rounded-lg bg-accent text-white hover:opacity-85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Validiraj, poveži i pokreni
      </button>
    </div>
  );
}
