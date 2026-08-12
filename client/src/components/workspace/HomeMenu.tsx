import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../lib/auth.js";
import { LANGS, getLang, setLang, type Lang } from "../../lib/i18n.js";

interface Props {
  onOpenHowItWorks?: () => void;
  onOpenSettings?: () => void;
  onOpenExport?: () => void;
  onOpenNotifications?: () => void;
  onOpenWorktrees?: () => void;
  onOpenBrowserVerify?: () => void;
  onOpenRollback?: () => void;
  onOpenContext?: () => void;
  onOpenGateway?: () => void;
  onOpenProviders?: () => void;
  onOpenMultiAgent?: () => void;
  onOpenHomeCenter?: () => void;
  onOpenDesignAssets?: () => void;
  onOpenUsage?: () => void;
  onOpenRuntimeManager?: () => void;
  onOpenQuickStart?: () => void;
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

export default function HomeMenu({ onOpenHowItWorks, onOpenSettings, onOpenExport, onOpenNotifications, onOpenWorktrees, onOpenBrowserVerify, onOpenRollback, onOpenContext, onOpenGateway, onOpenProviders, onOpenMultiAgent, onOpenHomeCenter, onOpenDesignAssets, onOpenUsage, onOpenRuntimeManager, onOpenQuickStart }: Props) {
  const [open, setOpen] = useState(false);
  const [showEditors, setShowEditors] = useState(false);
  const [showLangs, setShowLangs] = useState(false);
  const [lang, setLangState] = useState<Lang>(getLang());
  const { user, logout } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowEditors(false);
        setShowLangs(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const setActiveLang = (code: Lang) => {
    setLang(code);
    setLangState(code);
    setShowLangs(false);
    setOpen(false);
  };

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
        onClick={() => { setOpen(!open); setShowEditors(false); setShowLangs(false); }}
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-transparent text-text-secondary hover:text-text hover:border-border-light transition-colors"
        title="Izbornik"
      >
        ☰
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 max-h-[80vh] overflow-y-auto bg-surface border border-border rounded-xl shadow-xl z-50 py-1">
          {/* User info */}
          {user && (
            <div className="px-3 py-2 border-b border-border">
              <div className="text-[11px] text-text-muted">Prijavljen kao</div>
              <div className="text-xs font-medium text-text truncate">{user.email}</div>
            </div>
          )}

          {/* Language selector — always available, one tap */}
          <div className="px-3 py-2 border-b border-border">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">
              Jezik / Language
            </div>
            <button
              onClick={() => setShowLangs((v) => !v)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border bg-surface-2 text-[12px] text-text hover:border-border-light transition-colors"
              title="Promijeni jezik"
            >
              <span className="text-[12px]">🌐</span>
              <span className="flex-1 text-left truncate">
                {LANGS.find((l) => l.code === lang)?.label ?? "English"}
              </span>
              <span className="text-[10px] text-text-muted">{showLangs ? "▾" : "▸"}</span>
            </button>
            {showLangs && (
              <div className="mt-1.5 grid grid-cols-1 gap-0.5 max-h-48 overflow-y-auto overscroll-contain">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setActiveLang(l.code)}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-[12px] text-left hover:bg-surface-2 transition-colors ${
                      l.code === lang ? "text-accent font-medium" : "text-text"
                    }`}
                  >
                    <span className="truncate">{l.label}</span>
                    {l.code === lang && <span className="text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* How it works */}
          <button
            onClick={() => { onOpenHomeCenter?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">🏠</span>
            Home Center
          </button>

          <div className="border-t border-border my-1" />

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
              <div className="bg-surface-2 border-t border-border/50">
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

          {/* Browser Verify */}
          <button
            onClick={() => { onOpenBrowserVerify?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">🌐</span>
            Browser Verifikacija
          </button>

          {/* Rollback */}
          <button
            onClick={() => { onOpenRollback?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">↺</span>
            Historija verzija
          </button>

          {/* Context Engine */}
          <button
            onClick={() => { onOpenContext?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">🧠</span>
            Kontekst engine
          </button>

          {/* AI Gateway */}
          <button
            onClick={() => { onOpenGateway?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">⚡</span>
            AI Gateway
          </button>

          {/* Direct Providers */}
          <button
            onClick={() => { onOpenProviders?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">🔗</span>
            Direktni Provideri
          </button>

          {/* Multi-Agent */}
          <button
            onClick={() => { onOpenMultiAgent?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">🤖</span>
            Multi-Agent Sistem
          </button>

          {/* Design Assets */}
          <button
            onClick={() => { onOpenDesignAssets?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">🎨</span>
            Design Assets
          </button>

          {/* Usage & Cost */}
          <button
            onClick={() => { onOpenUsage?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">📊</span>
            Usage & Cost
          </button>

          {/* Runtime Manager */}
          <button
            onClick={() => { onOpenRuntimeManager?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">⚙</span>
            Runtime Manager
          </button>

          {/* Quick Start */}
          <button
            onClick={() => { onOpenQuickStart?.(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-2 hover:text-text transition-colors text-left"
          >
            <span className="w-4 text-center text-[11px]">✨</span>
            Quick Start
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
