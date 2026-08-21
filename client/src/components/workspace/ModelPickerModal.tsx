import { useEffect, useMemo, useState } from "react";
import {
  THINKING_BUDGETS,
  type Provider,
  type ThinkingBudget,
} from "../../lib/models.js";
import InlineApiKeyForm from "./InlineApiKeyForm.js";
import { hasApiKey } from "../../lib/chat.js";
import { needsApiKey } from "../../lib/models.js";
import { t, useLang } from "../../lib/i18n.js";

interface Props {
  open: boolean;
  title: string;
  providerId: string;
  modelId: string;
  thinking: ThinkingBudget;
  providers: Provider[];
  loading?: boolean;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onThinkingChange: (budget: ThinkingBudget) => void;
  onApiKeyChange?: () => void;
  onClose: () => void;
}

export default function ModelPickerModal({
  open,
  title,
  providerId,
  modelId,
  thinking,
  providers,
  loading,
  onProviderChange,
  onModelChange,
  onThinkingChange,
  onApiKeyChange,
  onClose,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState(providerId);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [inlineKeyFor, setInlineKeyFor] = useState<string | null>(null);
  const [pendingModelId, setPendingModelId] = useState<string | null>(null);
  const [providerKeys, setProviderKeys] = useState<Record<string, boolean>>({});
  useLang();

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedProviderId(providerId);
      setShowKeyInput(false);
      setInlineKeyFor(null);
      setPendingModelId(null);
      const loadKeys = async () => {
        const results = await Promise.all(providers.map((p) => hasApiKey(p.id)));
        const keys: Record<string, boolean> = Object.fromEntries(
          providers.map((p, i) => [p.id, results[i]])
        );
        // Only fill in values that are still unknown. A key the user saved while
        // this load was in flight (onSaved) must not be clobbered back to false
        // by a stale result.
        setProviderKeys((prev) => {
          const next = { ...prev };
          for (const [id, has] of Object.entries(keys)) {
            if (next[id] === undefined) next[id] = has;
          }
          return next;
        });
      };
      loadKeys();
    }
  }, [open, providerId, providers]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const filteredProviders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return providers;
    return providers
      .map((p) => ({
        ...p,
        models: p.models.filter(
          (m) =>
            m.id.toLowerCase().includes(q) ||
            m.name.toLowerCase().includes(q)
        ),
      }))
      .filter((p) => p.models.length > 0 || p.name.toLowerCase().includes(q));
  }, [providers, search]);

  const selectedProvider =
    providers.find((p) => p.id === selectedProviderId) || providers[0];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl sm:mx-4 bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[85dvh] sm:h-[75vh] flex flex-col animate-slide-up">
        {/* Handle — mobile bottom-sheet indikator */}
        <div className="flex justify-center pt-2 pb-0 shrink-0 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-text-muted/40" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm text-accent shrink-0">✦</span>
            <span className="text-[13px] font-semibold text-text truncate">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center border border-border bg-surface-2 text-text-muted hover:text-text hover:bg-surface-3 transition-colors shrink-0"
            title={t("common.close")}
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b border-border shrink-0">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("models.search")}
            className="w-full px-3 py-2 text-[13px] rounded-lg border border-border bg-surface-2 text-text placeholder-text-muted outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex">
          {/* Provider sidebar */}
          <div className="w-52 shrink-0 border-r border-border overflow-y-auto bg-surface">
            {(["cloud", "local", "vps"] as const).map((source) => {
              const group = filteredProviders.filter((p) => (p.source || "cloud") === source);
              if (group.length === 0) return null;
              const header =
                source === "cloud" ? "☁️ Cloud API"
                : source === "local" ? "🧠 Lokalni (Zen/Go)"
                : "🖥️ VPS (Ollama)";
              return (
                <div key={source}>
                  <div className="sticky top-0 z-10 bg-surface px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-text-muted border-b border-border/40">
                    {header}
                  </div>
                  {group.map((p) => {
                    const hasKey = !needsApiKey(p.id) || providerKeys[p.id] || false;
                    return (
                      <div key={p.id}>
                        <div
                          onClick={() => {
                            setSelectedProviderId(p.id);
                            setShowKeyInput(false);
                            setInlineKeyFor(null);
                            setPendingModelId(null);
                          }}
                          className={`w-full flex items-center justify-between gap-1 px-3 py-2 text-left hover:bg-surface-2 transition-colors cursor-pointer ${
                            selectedProviderId === p.id ? "bg-surface-2" : ""
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[12px] text-text truncate">{p.name}</span>
                            {p.id === "openrouter" && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-accent-dim text-accent font-medium shrink-0">
                                {p.models.length}
                              </span>
                            )}
                          </div>
                          {hasKey ? (
                            <span
                              className="text-green-500 text-[12px] shrink-0"
                              title={t("models.keyReady")}
                            >
                              ✓
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProviderId(p.id);
                                setShowKeyInput(false);
                                setInlineKeyFor((cur) => (cur === p.id ? null : p.id));
                              }}
                              className="text-[10px] px-1.5 py-0.5 rounded-md bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 font-medium shrink-0"
                              title={t("models.addApiKey")}
                            >
                              {t("models.addKey")}
                            </button>
                          )}
                        </div>
                        {inlineKeyFor === p.id && !hasKey && (
                          <InlineApiKeyForm
                            providerId={p.id}
                            providerName={p.name}
                            autoFocus
                            onSaved={() => {
                              setProviderKeys((prev) => ({ ...prev, [p.id]: true }));
                              setInlineKeyFor(null);
                              setPendingModelId(null);
                              onApiKeyChange?.();
                            }}
                            onCancel={() => setInlineKeyFor(null)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {filteredProviders.length === 0 && (
              <div className="p-3 text-center text-[11px] text-text-muted">
                Nema provajdera
              </div>
            )}
          </div>

          {/* Model list */}
          <div className="flex-1 flex flex-col min-w-0">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[12px] text-text-muted animate-pulse">
                  Učitavanje modela...
                </span>
              </div>
            ) : selectedProvider ? (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
                  <span className="text-[11px] font-medium text-text-secondary truncate">
                    {selectedProvider.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {!providerKeys[selectedProvider.id] && (
                      <button
                        onClick={() => setShowKeyInput((v) => !v)}
                        className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                          showKeyInput
                            ? "bg-surface-3 text-text-muted hover:text-text"
                            : "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
                        }`}
                      >
                        {showKeyInput ? t("common.cancel") : t("models.addKey")}
                      </button>
                    )}
                    <span className="text-[10px] text-text-muted">
                      {t("models.count", { n: selectedProvider.models.length })}
                    </span>
                  </div>
                </div>
                {showKeyInput && (
                  <InlineApiKeyForm
                    providerId={selectedProvider.id}
                    providerName={selectedProvider.name}
                    autoFocus
                    onSaved={() => {
                      setProviderKeys((prev) => ({
                        ...prev,
                        [selectedProvider.id]: true,
                      }));
                      setShowKeyInput(false);
                      setPendingModelId(null);
                      onApiKeyChange?.();
                      const pm = pendingModelId;
                      if (pm) {
                        onProviderChange(selectedProvider.id);
                        onModelChange(pm);
                        onClose();
                      }
                    }}
                  />
                )}
                <div className="overflow-y-auto flex-1">
                  {selectedProvider.models.length === 0 && (
                    <div className="p-4 text-center text-[12px] text-text-muted">
                      {t("models.noResults")}
                    </div>
                  )}
                  {selectedProvider.models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (needsApiKey(selectedProvider.id) && !providerKeys[selectedProvider.id]) {
                          setPendingModelId(m.id);
                          setShowKeyInput(true);
                          return;
                        }
                        onProviderChange(selectedProvider.id);
                        onModelChange(m.id);
                        onClose();
                      }}
                      title={
                        needsApiKey(selectedProvider.id) && !providerKeys[selectedProvider.id]
                          ? t("models.keyNeeded")
                          : undefined
                      }
                      className={`w-full flex items-center justify-between gap-2 px-4 py-2 text-left hover:bg-surface-2 transition-colors ${
                        needsApiKey(selectedProvider.id) && !providerKeys[selectedProvider.id] ? "opacity-40 cursor-not-allowed" : ""
                      } ${
                        m.id === modelId && selectedProvider.id === providerId
                          ? "bg-surface-2"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] text-text truncate">
                          {m.name}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono truncate hidden sm:inline">
                          {m.id}
                        </span>
                        {m.thinking && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-accent-blue-dim text-accent-blue font-medium shrink-0">
                            thinking
                          </span>
                        )}
                      </div>
                      {m.id === modelId &&
                        selectedProvider.id === providerId && (
                          <span className="text-accent text-xs shrink-0">✓</span>
                        )}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {/* Thinking budget */}
            <div className="border-t border-border px-4 py-2.5 shrink-0">
              <div className="text-[10px] text-text-muted mb-1.5 font-medium uppercase tracking-wider">
                {t("models.thinking")}
              </div>
              <div className="flex gap-1">
                {THINKING_BUDGETS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onThinkingChange(b.id)}
                    title={b.desc}
                    className={`flex-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      thinking === b.id
                        ? "bg-accent-dim text-accent border border-accent-border"
                        : "bg-surface-3 text-text-muted border border-transparent hover:text-text-secondary"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
