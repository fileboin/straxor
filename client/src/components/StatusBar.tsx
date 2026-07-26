import { useState, useEffect } from "react";

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
    </div>
  );
}
