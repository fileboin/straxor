import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useModelCatalog,
  THINKING_BUDGETS,
  type Provider,
  type Model,
  type ThinkingBudget,
} from "../../lib/models.js";
import InlineApiKeyForm from "./InlineApiKeyForm.js";
import { hasApiKey } from "../../lib/chat.js";
import { needsApiKey } from "../../lib/models.js";

interface Props {
  providerId: string;
  modelId: string;
  thinking: ThinkingBudget;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onThinkingChange: (budget: ThinkingBudget) => void;
  onApiKeyChange?: () => void;
}

const DROPDOWN_W = 288;

export default function ProviderModelDropdown({
  providerId,
  modelId,
  thinking,
  onProviderChange,
  onModelChange,
  onThinkingChange,
  onApiKeyChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"providers" | "models">("providers");
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [providerKeys, setProviderKeys] = useState<Record<string, boolean>>({});
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { providers } = useModelCatalog();

  const currentProvider = providers.find((p) => p.id === providerId);
  const currentModel = currentProvider?.models.find((m) => m.id === modelId);

  // Load API key status for all providers
  useEffect(() => {
    if (open) {
      const loadKeys = async () => {
        const keys: Record<string, boolean> = {};
        for (const p of providers) {
          keys[p.id] = await hasApiKey(p.id);
        }
        setProviderKeys(keys);
      };
      loadKeys();
    }
  }, [open, providers]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setView("providers");
      }
    };
    const close = () => {
      setOpen(false);
      setView("providers");
    };
    document.addEventListener("mousedown", handler);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const openMenu = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const top = Math.min(
        r.bottom + 4,
        Math.max(8, window.innerHeight - Math.round(window.innerHeight * 0.5) - 8)
      );
      let left = Math.min(r.right - DROPDOWN_W, window.innerWidth - DROPDOWN_W - 8);
      left = Math.max(8, left);
      setPos({ top, left });
    }
    setOpen((o) => !o);
  };

  const handleProviderClick = (provider: Provider) => {
    setSelectedProvider(provider);
    setView("models");
  };

  const handleModelClick = (model: Model) => {
    if (selectedProvider && selectedProvider.id !== providerId) {
      onProviderChange(selectedProvider.id);
    }
    onModelChange(model.id);
    setOpen(false);
    setView("providers");
  };

  const handleBack = () => {
    setView("providers");
    setSelectedProvider(null);
  };

  const selectedHasKey = selectedProvider ? !needsApiKey(selectedProvider.id) || providerKeys[selectedProvider.id] || false : true;

  return (
    <div className="relative" ref={rootRef}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={openMenu}
        className="flex items-center gap-1 px-1.5 py-1 rounded-lg border border-border bg-surface-2 text-[11px] text-text-secondary hover:border-border-light hover:text-text focus:outline-none focus:border-accent transition-colors sm:gap-1.5 sm:px-2"
      >
        <span className="truncate max-w-[50px] sm:max-w-[80px]">
          {currentProvider?.name || "Provider"}
        </span>
        <span className="text-text-muted">·</span>
        <span className="truncate max-w-[50px] sm:max-w-[80px]">
          {currentModel?.name || "Model"}
        </span>
        <svg
          className={`w-2.5 h-2.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 10 6"
          fill="none"
        >
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown (portal — never clipped by panel overflow) */}
      {open &&
        pos &&
        createPortal(
          <div
            className="z-[100] w-[288px] max-w-[calc(100vw-16px)] max-h-[50vh] rounded-xl border border-border bg-surface shadow-2xl shadow-black/50 overflow-hidden flex flex-col"
            style={{ position: "fixed", top: pos.top, left: pos.left }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
              {view === "models" ? (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 text-[11px] text-text-secondary hover:text-text transition-colors"
                >
                  <span>←</span>
                  <span>{selectedProvider?.name}</span>
                </button>
              ) : (
                <span className="text-[11px] font-medium text-text-secondary">
                  Provider
                </span>
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  setView("providers");
                }}
                className="text-text-muted hover:text-text text-xs transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Provider list */}
            {view === "providers" && (
              <div className="overflow-y-auto flex-1">
                {(["cloud", "local", "vps"] as const).map((source) => {
                  const group = providers.filter((p) => (p.source || "cloud") === source);
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
                          <button
                            key={p.id}
                            onClick={() => handleProviderClick(p)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface-2 transition-colors ${
                              p.id === providerId ? "bg-surface-2" : ""
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[13px] text-text">{p.name}</span>
                              {hasKey && (
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {p.status === "needs-setup" && !hasKey && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-yellow-500/10 text-yellow-500 transition-colors">
                                  Dodaj key
                                </span>
                              )}
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                                  p.status === "ready" || hasKey
                                    ? "bg-green-500/10 text-green-500"
                                    : "bg-yellow-500/10 text-yellow-500"
                                }`}
                              >
                                {p.status === "ready" || hasKey ? "Ready" : "Needs Setup"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Model list (key form inline at top when key missing) */}
            {view === "models" && selectedProvider && (
              <div className="overflow-y-auto flex-1">
                {!selectedHasKey && (
                  <InlineApiKeyForm
                    providerId={selectedProvider.id}
                    providerName={selectedProvider.name}
                    autoFocus
                    onSaved={() => {
                      setProviderKeys((prev) => ({
                        ...prev,
                        [selectedProvider.id]: true,
                      }));
                      onApiKeyChange?.();
                    }}
                  />
                )}
                {selectedProvider.models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (!selectedHasKey) return;
                      handleModelClick(m);
                    }}
                    title={
                      selectedHasKey ? undefined : "Sačuvaj API key da aktiviraš modele"
                    }
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface-2 transition-colors ${
                      selectedHasKey ? "" : "opacity-40 cursor-not-allowed"
                    } ${
                      m.id === modelId && selectedProvider.id === providerId
                        ? "bg-surface-2"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] text-text truncate">{m.name}</span>
                      {m.free && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-medium shrink-0">
                          Free
                        </span>
                      )}
                      {m.vision && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/15 text-purple-400 font-medium shrink-0">
                          Vision
                        </span>
                      )}
                      {m.thinking && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-accent-blue-dim text-accent-blue font-medium shrink-0">
                          thinking
                        </span>
                      )}
                    </div>
                    {m.id === modelId && selectedProvider.id === providerId && (
                      <span className="text-accent text-xs shrink-0">✓</span>
                    )}
                  </button>
                ))}

                {/* Thinking Budget */}
                <div className="border-t border-border px-3 py-2">
                  <div className="text-[10px] text-text-muted mb-1.5 font-medium uppercase tracking-wider">
                    Thinking Budget
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
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
