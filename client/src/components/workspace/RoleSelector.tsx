import { useState, useRef, useEffect } from "react";
import { ROLES, type AgentRole, getRoleById } from "../../lib/roles.js";

interface Props {
  role: AgentRole;
  onChange: (role: AgentRole) => void;
}

export default function RoleSelector({ role, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getRoleById(role);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-surface-2 text-[11px] text-text-secondary hover:border-border-light hover:text-text transition-colors`}
        title={`Uloga: ${current.label}`}
      >
        <span className="text-xs">{current.icon}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <svg
          className={`w-2 h-2 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 10 6"
          fill="none"
        >
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-surface border border-border rounded-xl shadow-xl shadow-black/30 z-50 py-1 overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
              Uloga agenta
            </div>
          </div>
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                onChange(r.id);
                setOpen(false);
              }}
              className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                r.id === role
                  ? "bg-surface-2"
                  : "hover:bg-surface-2/50"
              }`}
            >
              <span className="text-sm mt-0.5 shrink-0">{r.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-text">{r.label}</span>
                  {r.id === role && (
                    <span className="text-accent text-[10px]">●</span>
                  )}
                </div>
                <div className="text-[10px] text-text-muted mt-0.5 leading-snug">
                  {r.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
