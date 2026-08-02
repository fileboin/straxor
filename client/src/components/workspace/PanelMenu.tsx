import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ROLES, type AgentRole } from "../../lib/roles.js";
import { t } from "../../lib/i18n.js";
import {
  listGitTokens,
  addGitToken,
  renameGitToken,
  activateGitToken,
  deleteGitToken,
  type GitTokenSlot,
} from "../../lib/git-remote.js";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_PRESETS, clampZoom } from "./ZoomControl.js";

interface Props {
  role: AgentRole;
  onRoleChange: (role: AgentRole) => void;
  zoom: number;
  onZoomChange: (z: number) => void;
  onOpenModelPicker: () => void;
  onOpenPromptLibrary: () => void;
  onOpenGitRemote: () => void;
  storageKey: string;
}

const PLATFORM = "github";

export default function PanelMenu({
  role,
  onRoleChange,
  zoom,
  onZoomChange,
  onOpenModelPicker,
  onOpenPromptLibrary,
  onOpenGitRemote,
  storageKey,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tokens, setTokens] = useState<GitTokenSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addToken, setAddToken] = useState("");
  const [adding, setAdding] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const pct = Math.round(zoom * 100);

  const selectedKey = `straxor.gitToken.${storageKey}`;
  const [selectedId, setSelectedId] = useState<string>(() => localStorage.getItem(selectedKey) || "");

  useEffect(() => {
    if (selectedId) localStorage.setItem(selectedKey, selectedId);
    else localStorage.removeItem(selectedKey);
  }, [selectedId, selectedKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { tokens: list } = await listGitTokens(PLATFORM);
      setTokens(list);
    } catch {
      setTokens([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  function flash(msg: string) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 2500);
  }

  async function handleAdd() {
    if (!addToken.trim()) return;
    setAdding(true);
    try {
      const res = await addGitToken(PLATFORM, {
        name: addName.trim() || "GitHub",
        token: addToken.trim(),
      });
      setSelectedId(res.token.id);
      setAddOpen(false);
      setAddName("");
      setAddToken("");
      flash(res.token.username ? `Token sačuvan (${res.token.username})` : "Token sačuvan");
      await load();
    } catch (e: any) {
      flash(e.message || "Token nije validan");
    }
    setAdding(false);
  }

  async function handleActivate(id: string) {
    setSelectedId(id);
    try {
      await activateGitToken(PLATFORM, id);
      await load();
      flash("Token aktiviran");
    } catch (e: any) {
      flash(e.message || "Neuspjeh");
    }
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    try {
      await renameGitToken(PLATFORM, id, renameValue.trim());
      setRenameId(null);
      flash("Token preimenovan");
      await load();
    } catch (e: any) {
      flash(e.message || "Neuspjeh");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteGitToken(PLATFORM, id);
      if (selectedId === id) setSelectedId("");
      flash("Token obrisan");
      await load();
    } catch (e: any) {
      flash(e.message || "Neuspjeh");
    }
  }

  const activeSlot = tokens.find((s) => s.id === selectedId) || tokens.find((s) => s.isDefault);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (!open) {
            const r = btnRef.current?.getBoundingClientRect();
            if (r) {
              const W = 340;
              const top = Math.min(
                r.bottom + 4,
                Math.max(8, window.innerHeight - Math.round(window.innerHeight * 0.8) - 8)
              );
              let left = Math.min(r.right - W, window.innerWidth - W - 8);
              left = Math.max(8, left);
              setMenuPos({ top, left });
            }
          }
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        className={`flex items-center gap-1.5 h-8 pl-2 pr-2 rounded-lg border text-[12px] font-medium transition-colors sm:pr-2.5 ${
          open
            ? "border-accent/50 bg-accent/10 text-accent"
            : "border-border bg-surface-3 text-text-secondary hover:text-text hover:border-border-light"
        }`}
        title={t("panelMenu.title")}
        aria-label={t("panelMenu.title")}
      >
        <span className="text-sm leading-none">⚙</span>
        <span className="hidden xl:inline">{t("panelMenu.title")}</span>
      </button>

      {open &&
        menuPos &&
        createPortal(
          <div
            className="z-[100] w-[340px] max-w-[calc(100vw-16px)] max-h-[80vh] overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl shadow-black/50 p-2.5 space-y-3.5"
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
          >
          <div className="flex items-center justify-between px-1.5">
            <div className="text-[11px] uppercase tracking-wider text-text-muted font-medium">
              {t("panelMenu.title")}
            </div>
            {actionMsg && <div className="text-[11px] text-green-400">{actionMsg}</div>}
          </div>

          {/* Uloga agenta */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-muted px-1.5 pb-1">
              {t("panelMenu.role")}
            </div>
            <div className="grid grid-cols-1 gap-1">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { onRoleChange(r.id); }}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg text-left text-[12px] transition-colors ${
                    r.id === role ? "bg-accent/15 text-accent font-semibold" : "text-text hover:bg-surface-2"
                  }`}
                >
                  <span className="text-[13px] w-5 text-center shrink-0">{r.icon}</span>
                  <span className="flex-1 min-w-0 truncate">{r.label}</span>
                  {r.id === role && <span className="text-accent text-[10px]">●</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Model */}
          <div className="px-1.5">
            <div className="text-[11px] uppercase tracking-wider text-text-muted pb-1">{t("panelMenu.model")}</div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onOpenModelPicker}
                className="flex-1 px-2 py-2 rounded-lg border border-border bg-surface-2 text-[12px] text-text hover:border-border-light hover:text-text transition-colors"
              >
                ✦ {t("panelMenu.model")}
              </button>
              <button
                type="button"
                onClick={onOpenPromptLibrary}
                className="flex-1 px-2 py-2 rounded-lg border border-border bg-surface-2 text-[12px] text-text hover:border-border-light hover:text-text transition-colors"
              >
                💡 {t("panelMenu.prompts")}
              </button>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Zoom */}
          <div className="px-1.5">
            <div className="flex items-center justify-between px-0 pb-1">
              <div className="text-[11px] uppercase tracking-wider text-text-muted">{t("zoom.title")}</div>
              <div className="text-[12px] tabular-nums text-text-muted">{pct}%</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onZoomChange(clampZoom(zoom - 0.05))}
                disabled={zoom <= ZOOM_MIN}
                className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 border border-border disabled:opacity-30"
              >
                −
              </button>
              <input
                type="range"
                min={Math.round(ZOOM_MIN * 100)}
                max={Math.round(ZOOM_MAX * 100)}
                step={5}
                value={pct}
                onChange={(e) => onZoomChange(Number(e.target.value) / 100)}
                className="flex-1 accent-[#ff4d2e]"
                aria-label={t("zoom.title")}
              />
              <button
                type="button"
                onClick={() => onZoomChange(clampZoom(zoom + 0.05))}
                disabled={zoom >= ZOOM_MAX}
                className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 border border-border disabled:opacity-30"
              >
                +
              </button>
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              {ZOOM_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onZoomChange(p.value)}
                  className={`flex-1 px-1 py-1.5 rounded-md text-[11px] transition-colors ${
                    Math.abs(zoom - p.value) < 0.001
                      ? "bg-accent/15 text-accent font-semibold"
                      : "text-text-muted hover:bg-surface-2 hover:text-text"
                  }`}
                >
                  {Math.round(p.value * 100)}%
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* GitHub token slots */}
          <div className="px-1.5">
            <div className="flex items-center justify-between pb-1">
              <div className="text-[11px] uppercase tracking-wider text-text-muted">GitHub token</div>
              <button
                type="button"
                onClick={onOpenGitRemote}
                className="text-[11px] text-text-muted hover:text-text"
              >
                {t("panelMenu.gitOpen")} →
              </button>
            </div>

            {activeSlot && (
              <div className="flex items-center gap-1.5 px-2 py-2 mb-1.5 rounded-lg border border-green-500/30 bg-green-500/5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                <span className="text-[12px] text-text flex-1 min-w-0 truncate">
                  {activeSlot.username || activeSlot.name}
                </span>
                <span className="text-[11px] text-text-muted shrink-0">aktivni</span>
              </div>
            )}

            <div className="space-y-1">
              {loading && <div className="text-[11px] text-text-muted px-1.5 py-1">...</div>}
              {!loading && tokens.length === 0 && (
                <div className="text-[11px] text-text-muted px-1.5 py-1">
                  {t("panelMenu.noTokens")}
                </div>
              )}
              {tokens.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg border transition-colors ${
                    s.id === selectedId
                      ? "border-accent/40 bg-accent/5"
                      : "border-transparent hover:bg-surface-2"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleActivate(s.id)}
                    className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                    title={t("panelMenu.gitActivate")}
                  >
                    <span className={`w-3 h-3 rounded-full border shrink-0 ${s.isDefault ? "border-green-400 bg-green-400/40" : "border-border"}`} />
                    <span className="text-[12px] text-text flex-1 min-w-0 truncate">
                      {s.name}
                      {s.username && <span className="text-text-muted"> · @{s.username}</span>}
                    </span>
                    {s.id === selectedId && <span className="text-[10px] text-accent shrink-0">●</span>}
                  </button>
                  {renameId === s.id ? (
                    <input
                      autoFocus
                      defaultValue={s.name}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(s.id);
                        if (e.key === "Escape") setRenameId(null);
                      }}
                      onBlur={() => setRenameId(null)}
                      className="w-20 input px-1 py-0.5 text-[12px]"
                    />
                  ) : (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                      <button
                        type="button"
                        onClick={() => { setRenameId(s.id); setRenameValue(s.name); }}
                        className="w-5 h-5 rounded flex items-center justify-center text-text-muted hover:text-text hover:bg-surface text-[11px]"
                        title={t("panelMenu.gitRename")}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        className="w-5 h-5 rounded flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-500/10 text-[11px]"
                        title={t("panelMenu.gitDelete")}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {addOpen ? (
              <div className="mt-1.5 space-y-1.5">
                <input
                  autoFocus
                  className="input w-full px-2 py-2 text-[12px]"
                  placeholder={t("panelMenu.gitName")}
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                />
                <div className="flex gap-1.5">
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    className="input w-full px-2 py-2 text-[12px]"
                    placeholder="ghp_... / github_pat_..."
                    value={addToken}
                    onChange={(e) => setAddToken(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                  />
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={adding || !addToken.trim()}
                    className="px-2.5 py-1 rounded-lg bg-accent text-white text-[12px] disabled:opacity-40"
                  >
                    {adding ? "..." : "✓"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="w-full mt-1.5 px-2 py-1.5 rounded-lg border border-dashed border-border text-[12px] text-text-muted hover:text-text hover:border-border-light transition-colors"
              >
                + {t("panelMenu.gitAdd")}
              </button>
            )}
          </div>
          </div>,
          document.body
        )}
    </div>
  );
}
