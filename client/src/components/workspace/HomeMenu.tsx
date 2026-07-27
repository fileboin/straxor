import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../lib/auth.js";

interface Props {
  onOpenHowItWorks?: () => void;
  onOpenSettings?: () => void;
  onOpenExport?: () => void;
  onOpenNotifications?: () => void;
  onOpenWorktrees?: () => void;
}

const EDITORS = [
  {
    id: "vscode",
    name: "VS Code",
    icon: "◇",
    deeplink: "vscode://file/",
  },
  {
    id: "zed",
    name: "Zed",
    icon: "◆",
    deeplink: "zed://file/",
  },
  {
    id: "cursor",
    name: "Cursor",
    icon: "◈",
    deeplink: "cursor://file/",
  },
];

export default function HomeMenu({ onOpenHowItWorks, onOpenSettings, onOpenExport, onOpenNotifications, onOpenWorktrees }: Props) {
  const [open, setOpen] = useState(false);
  const [showEditors, setShowEditors] = useState(false);
  const { user, logout } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowEditors(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleLogout = () => {
    setOpen(false);
    logout();
  };

  const openEditor = (deeplink: string) => {
    window.open(deeplink, "_blank");
    setOpen(false);
    setShowEditors(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => { setOpen(!open); setShowEditors(false); }}
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-transparent text-text-secondary hover:text-text hover:border-border-light transition-colors"
        title="Izbornik"
      >
        ☰
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-surface border border-border rounded-xl shadow-xl z-50 py-1 overflow-hidden">
          {/* User info */}
          {user && (
            <div className="px-3 py-2 border-b border-border">
              <div className="text-[11px] text-text-muted">Prijavljen kao</div>
              <div className="text-xs font-medium text-text truncate">{user.email}</div>
            </div>
          )}

          {/* How it works */}
          <button
            onClick={() => { onOpenHowItWorks?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">?</span>
            Kako radi projekat
          </button>

          {/* External editor */}
          <div>
            <button
              onClick={() => setShowEditors(!showEditors)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
            >
              <span className="w-4 text-center text-[11px]">⊞</span>
              Otvori eksterni editor
              <span className="ml-auto text-[10px] text-text-muted">{showEditors ? "▾" : "▸"}</span>
            </button>
            {showEditors && (
              <div className="bg-surface-2/50 border-t border-border/50">
                {EDITORS.map((ed) => (
                  <button
                    key={ed.id}
                    onClick={() => openEditor(ed.deeplink)}
                    className="w-full flex items-center gap-2.5 pl-10 pr-3 py-1.5 text-[11px] text-text-muted hover:text-text hover:bg-surface-2 transition-colors text-left"
                  >
                    <span className="w-4 text-center text-[10px]">{ed.icon}</span>
                    {ed.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={() => { onOpenSettings?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">⚙</span>
            Postavke
          </button>

          {/* Export */}
          <button
            onClick={() => { onOpenExport?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">📦</span>
            Export projekta
          </button>

          {/* Notifications */}
          <button
            onClick={() => { onOpenNotifications?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">🔔</span>
            Notifikacije
          </button>

          {/* Worktrees */}
          <button
            onClick={() => { onOpenWorktrees?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">🌳</span>
            Git Worktrees
          </button>

          {/* Documentation */}
          <a
            href="https://straxor.dev/docs"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">📖</span>
            Dokumentacija
          </a>

          {/* Divider */}
          <div className="border-t border-border my-1" />

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">⏻</span>
            Odjava
          </button>
        </div>
      )}
    </div>
  );
}
