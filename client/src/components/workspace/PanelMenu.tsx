import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ROLES, type AgentRole } from "../../lib/roles.js";
import { useTheme, ACCENT_COLORS, type AccentColor } from "../../lib/theme.js";
import { t } from "../../lib/i18n.js";
import {
  listGitTokens,
  addGitToken,
  renameGitToken,
  activateGitToken,
  deleteGitToken,
  type GitTokenSlot,
} from "../../lib/git-remote.js";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_PRESETS, clampZoom, VZOOM_MIN, VZOOM_MAX, VZOOM_PRESETS, clampVerticalZoom } from "./ZoomControl.js";

interface Props {
  role: AgentRole;
  onRoleChange: (role: AgentRole) => void;
  zoom: number;
  onZoomChange: (z: number) => void;
  verticalZoom: number;
  onVerticalZoomChange: (z: number) => void;
  onOpenModelPicker: () => void;
  onOpenPromptLibrary: () => void;
  onOpenGitRemote: () => void;
  onOpenCommandPalette?: () => void;
  storageKey: string;
  panelAccent?: string;
  onPanelAccentChange?: (color: string) => void;
  orchestratedModels: { providerId: string; modelId: string }[];
  onOrchestratedModelsChange: (models: { providerId: string; modelId: string }[]) => void;
  availableModels: { providerId: string; name: string; models: { id: string; name: string }[] }[];
}

const PLATFORM = "github";

export default function PanelMenu({
  role,
  onRoleChange,
  zoom,
  onZoomChange,
  verticalZoom,
  onVerticalZoomChange,
  onOpenModelPicker,
  onOpenPromptLibrary,
  onOpenGitRemote,
  onOpenCommandPalette,
  storageKey,
  panelAccent,
  onPanelAccentChange,
  orchestratedModels,
  onOrchestratedModelsChange,
  availableModels,
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
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const pct = Math.round(zoom * 100);
  const vPct = Math.round(verticalZoom * 100);
  const { accent, setAccent, setTheme } = useTheme();

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    const d = menuRef.current;
    if (!r || !d) return;
    const W = 340;
    const H = d.offsetHeight;
    let left = Math.min(r.right - W, window.innerWidth - W - 8);
    left = Math.max(8, left);
    const below = r.bottom + 4;
    let top = below;
    if (below + H > window.innerHeight - 8) {
      const above = r.top - H - 4;
      top = above >= 8 ? above : Math.max(8, window.innerHeight - H - 8);
    }
    setMenuPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [open, place, tokens, loading]);

  const selectAccent = (id: AccentColor) => {
    if (id === "white") setTheme("light");
    else if (id === "black") setTheme("dark");
    setAccent(id);
  };

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
      const target = e.target as Node;
      const insideTrigger =
        rootRef.current && rootRef.current.contains(target);
      const insideMenu = menuRef.current && menuRef.current.contains(target);
      if (!insideTrigger && !insideMenu) {
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
        onClick={() => setOpen((o) => !o)}
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
        createPortal(
          <div
            ref={menuRef}
            className="z-[100] w-[340px] max-w-[calc(100vw-16px)] max-h-[calc(100vh-16px)] overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl shadow-black/50 p-2.5 space-y-3.5"
            style={{ position: "fixed", top: menuPos?.top, left: menuPos?.left, visibility: menuPos ? "visible" : "hidden" }}
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
                onClick={() => { setOpen(false); onOpenModelPicker(); }}
                className="flex-1 px-2 py-2 rounded-lg border border-border bg-surface-2 text-[12px] text-text hover:border-border-light hover:text-text transition-colors"
              >
                ✦ {t("panelMenu.model")}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); onOpenPromptLibrary(); }}
                className="flex-1 px-2 py-2 rounded-lg border border-border bg-surface-2 text-[12px] text-text hover:border-border-light hover:text-text transition-colors"
              >
                💡 {t("panelMenu.prompts")}
              </button>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Komande (Command Palette) */}
          {onOpenCommandPalette && (
            <div className="px-1.5">
              <button
                type="button"
                onClick={() => { setOpen(false); onOpenCommandPalette(); }}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg border border-border bg-surface-2 text-[12px] text-text hover:border-border-light hover:text-text transition-colors"
              >
                <span className="text-[13px] w-5 text-center shrink-0">⌘</span>
                <span className="flex-1 min-w-0 text-left">{t("panelMenu.commands")}</span>
                <span className="text-[10px] text-text-muted shrink-0">Ctrl+K</span>
              </button>
            </div>
          )}

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
                className="flex-1 accent-[var(--accent)]"
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

          {/* Vertical zoom — top-down compression, independent of zoom */}
          <div className="px-1.5 mt-1">
            <div className="flex items-center justify-between px-0 pb-1">
              <div className="text-[11px] uppercase tracking-wider text-text-muted">{t("vzoom.title")}</div>
              <div className="text-[12px] tabular-nums text-text-muted">{vPct}%</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onVerticalZoomChange(clampVerticalZoom(verticalZoom - 0.05))}
                disabled={verticalZoom <= VZOOM_MIN}
                className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 border border-border disabled:opacity-30"
              >
                −
              </button>
              <input
                type="range"
                min={Math.round(VZOOM_MIN * 100)}
                max={Math.round(VZOOM_MAX * 100)}
                step={5}
                value={vPct}
                onChange={(e) => onVerticalZoomChange(Number(e.target.value) / 100)}
                className="flex-1 accent-[var(--accent)]"
                aria-label={t("vzoom.title")}
              />
              <button
                type="button"
                onClick={() => onVerticalZoomChange(clampVerticalZoom(verticalZoom + 0.05))}
                disabled={verticalZoom >= VZOOM_MAX}
                className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 border border-border disabled:opacity-30"
              >
                +
              </button>
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              {VZOOM_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onVerticalZoomChange(p.value)}
                  className={`flex-1 px-1 py-1.5 rounded-md text-[11px] transition-colors ${
                    Math.abs(verticalZoom - p.value) < 0.001
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

          {/* Tema (accent picker) */}
          <div className="px-1.5">
            <div className="flex items-center justify-between px-0 pb-1.5">
              <div className="text-[11px] uppercase tracking-wider text-text-muted">
                {t("panelMenu.theme")}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ACCENT_COLORS.map((c) => {
                const active = accent === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    onClick={() => selectAccent(c.id)}
                    className={`relative w-9 h-9 rounded-full transition-all hover:scale-110 shrink-0 ${
                      active
                        ? "ring-2 ring-accent ring-offset-2 ring-offset-surface"
                        : "ring-1 ring-border hover:ring-border-light"
                    }`}
                    style={{
                      backgroundColor: c.color,
                      boxShadow: active
                        ? `0 0 10px ${c.color}80`
                        : "0 1px 3px rgba(0,0,0,0.4)",
                    }}
                  >
                    {active && (
                      <span
                        className="absolute inset-0 flex items-center justify-center text-[12px] font-bold"
                        style={{
                          color:
                            c.id === "white" || c.id === "yellow" ? "#111" : "#fff",
                          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {onPanelAccentChange && (
            <>
              <div className="border-t border-border" />

              {/* Per-panel accent */}
              <div className="px-1.5">
                <div className="flex items-center justify-between px-0 pb-1.5">
                  <div className="text-[11px] uppercase tracking-wider text-text-muted">
                    {t("panelMenu.panelAccent")}
                  </div>
                  {panelAccent && (
                    <button
                      type="button"
                      onClick={() => onPanelAccentChange("")}
                      className="text-[10px] text-text-muted hover:text-text underline"
                      title="Reset na globalnu boju"
                    >
                      reset
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_COLORS.map((c) => {
                    const active = panelAccent === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        title={c.label}
                        aria-label={c.label}
                        onClick={() => onPanelAccentChange(c.id)}
                        className={`relative w-9 h-9 rounded-full transition-all hover:scale-110 shrink-0 ${
                          active
                            ? "ring-2 ring-accent ring-offset-2 ring-offset-surface"
                            : "ring-1 ring-border hover:ring-border-light"
                        }`}
                        style={{
                          backgroundColor: c.color,
                          boxShadow: active
                            ? `0 0 10px ${c.color}80`
                            : "0 1px 3px rgba(0,0,0,0.4)",
                        }}
                      >
                        {active && (
                          <span
                            className="absolute inset-0 flex items-center justify-center text-[12px] font-bold"
                            style={{
                              color:
                                c.id === "white" || c.id === "yellow"
                                  ? "#111"
                                  : "#fff",
                              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Multi-model orchestration selector */}
          <div className="border-t border-border" />
          <div className="px-1.5">
            <div className="flex items-center justify-between px-0 pb-1.5">
              <div className="text-[11px] uppercase tracking-wider text-text-muted">
                {t("panelMenu.orchestrator")}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-text-muted">
                  {orchestratedModels.length}
                </span>
                {orchestratedModels.length >= 3 && (
                  <span className="text-[10px] text-yellow-400" title="Više API poziva = više troškova">
                    ⚠
                  </span>
                )}
              </div>
            </div>
            {availableModels.map((provider) => (
              <div key={provider.providerId} className="mb-2">
                <div className="text-[10px] text-text-muted uppercase tracking-wider px-0 pb-1">
                  {provider.name}
                </div>
                <div className="flex flex-wrap gap-1">
                  {provider.models.map((m) => {
                    const active = orchestratedModels.some(
                      (om) => om.providerId === provider.providerId && om.modelId === m.id
                    );
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (active) {
                            onOrchestratedModelsChange(
                              orchestratedModels.filter(
                                (om) => !(om.providerId === provider.providerId && om.modelId === m.id)
                              )
                            );
                          } else {
                            onOrchestratedModelsChange([
                              ...orchestratedModels,
                              { providerId: provider.providerId, modelId: m.id },
                            ]);
                          }
                        }}
                        className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                          active
                            ? "border-accent/50 bg-accent/10 text-accent"
                            : "border-border bg-surface-2 text-text-muted hover:border-border-light hover:text-text"
                        }`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {orchestratedModels.length === 0 && (
              <div className="text-[11px] text-text-muted px-0 py-1">
                {t("panelMenu.orchestratorEmpty")}
              </div>
            )}
          </div>

          <div className="border-t border-border" />

          {/* GitHub token slots */}
          <div className="px-1.5">
            <div className="flex items-center justify-between pb-1">
              <div className="text-[11px] uppercase tracking-wider text-text-muted">GitHub token</div>
              <button
                type="button"
                onClick={() => { setOpen(false); onOpenGitRemote(); }}
                className="text-[11px] text-text-muted hover:text-text"
              >
                {t("panelMenu.gitOpen")} →
              </button>
              <button
                type="button"
                onClick={load}
                className="text-xs text-text-muted hover:text-text ml-2"
                title="Refresh tokens"
              >
                ⟳
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
