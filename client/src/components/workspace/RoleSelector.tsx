import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ROLES, type AgentRole, getRoleById } from "../../lib/roles.js";

interface Props {
  role: AgentRole;
  onChange: (role: AgentRole) => void;
}

const DROP_W = 256;

export default function RoleSelector({ role, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const current = getRoleById(role);

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    const d = dropRef.current;
    if (!r || !d) return;
    const left = Math.max(8, Math.min(r.right - DROP_W, window.innerWidth - DROP_W - 8));
    const H = d.offsetHeight;
    const below = r.bottom + 4;
    if (below + H <= window.innerHeight - 8) {
      setPos({ top: below, left });
    } else {
      const above = r.top - H - 4;
      if (above >= 8) {
        setPos({ bottom: window.innerHeight - r.top + 4, left });
      } else {
        setPos({ top: below, left });
      }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideBtn = btnRef.current && btnRef.current.contains(target);
      const insideDrop = dropRef.current && dropRef.current.contains(target);
      if (!insideBtn && !insideDrop) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", handler);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] transition-colors ${
          open
            ? "border-accent/50 bg-accent/10 text-accent"
            : "border-border bg-surface-2 text-text-secondary hover:border-border-light hover:text-text"
        }`}
        title={`Uloga: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
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

      {open &&
        createPortal(
          <div
            ref={dropRef}
            role="menu"
            className="fixed z-[120] w-[256px] bg-surface border border-border rounded-xl shadow-2xl shadow-black/50 py-1 overflow-hidden max-h-[calc(100vh-16px)] overflow-y-auto"
            style={{
              visibility: pos ? "visible" : "hidden",
              top: pos?.top,
              bottom: pos?.bottom,
              left: pos?.left,
            }}
          >
            <div className="px-3 py-2 border-b border-border">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                Uloga agenta
              </div>
            </div>
            {ROLES.map((r) => (
              <button
                key={r.id}
                role="menuitem"
                onClick={() => {
                  onChange(r.id);
                  setOpen(false);
                }}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  r.id === role
                    ? "bg-accent/10"
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
          </div>,
          document.body
        )}
    </div>
  );
}
