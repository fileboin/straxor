import { useState, useEffect } from "react";
import { LANGS, getLang, setLang, type Lang } from "../lib/i18n.js";

type Status = "ok" | "error" | "loading";

interface HealthItem {
  id: string;
  label: string;
  status: Status;
  detail?: string;
}

const INITIAL_HEALTH: HealthItem[] = [
  { id: "ai", label: "AI", status: "loading" },
  { id: "git", label: "Git", status: "loading" },
  { id: "vps", label: "Host-VPS", status: "loading" },
  { id: "runtime", label: "Runtime", status: "loading" },
  { id: "disk", label: "Disk", status: "loading" },
  { id: "memory", label: "Memory", status: "loading" },
  { id: "cpu", label: "CPU", status: "loading" },
  { id: "database", label: "Database", status: "loading" },
];

function StatusDot({ status }: { status: Status }) {
  if (status === "loading") {
    return (
      <span className="w-2 h-2 rounded-full bg-text-muted animate-pulse shrink-0" />
    );
  }
  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${
        status === "ok" ? "bg-green-500" : "bg-red-500"
      }`}
    />
  );
}

export default function StatusBar() {
  const [health, setHealth] = useState<HealthItem[]>(INITIAL_HEALTH);
  const [lang, setLangState] = useState<Lang>(getLang());
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHealth((prev) =>
        prev.map((item) => ({
          ...item,
          status: item.id === "vps" ? "error" : "ok",
        }))
      );
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-center gap-0 border-b border-border bg-surface overflow-x-auto shrink-0">
      {health.map((item, i) => (
        <div
          key={item.id}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] whitespace-nowrap ${
            i < health.length - 1 ? "border-r border-border" : ""
          }`}
        >
          <StatusDot status={item.status} />
          <span className="text-text-muted">{item.label}</span>
          {item.detail && (
            <span className="text-text-muted opacity-60">{item.detail}</span>
          )}
        </div>
      ))}
      <div className="relative ml-auto shrink-0 px-2">
        <button
          onClick={() => setLangOpen((o) => !o)}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text rounded-md hover:bg-surface-2 transition-colors"
          title="Language / Jezik"
        >
          <span>{LANGS.find((l) => l.code === lang)?.short ?? "EN"}</span>
          <span className="text-[9px] opacity-70">▾</span>
        </button>
        {langOpen && (
          <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-border bg-surface shadow-xl shadow-black/30 z-50 overflow-hidden max-h-80 overflow-y-auto">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  setLang(l.code);
                  setLangState(l.code);
                  setLangOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-[12px] hover:bg-surface-2 transition-colors ${
                  l.code === lang ? "text-accent font-medium" : "text-text"
                }`}
              >
                <span>{l.label}</span>
                {l.code === lang && <span>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
