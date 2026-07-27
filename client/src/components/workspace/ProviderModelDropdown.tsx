import { useState, useRef, useEffect } from "react";
import {
  PROVIDERS,
  THINKING_BUDGETS,
  type Provider,
  type Model,
  type ThinkingBudget,
} from "../../lib/models.js";
import ApiKeyInput from "./ApiKeyInput.js";
import { hasApiKey } from "../../lib/chat.js";

interface Props {
  providerId: string;
  modelId: string;
  thinking: ThinkingBudget;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onThinkingChange: (budget: ThinkingBudget) => void;
  onApiKeyChange?: () => void;
}

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
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [providerKeys, setProviderKeys] = useState<Record<string, boolean>>({});
  const ref = useRef<HTMLDivElement>(null);

  const currentProvider = PROVIDERS.find((p) => p.id === providerId);
  const currentModel = currentProvider?.models.find((m) => m.id === modelId);

  // Load API key status for all providers
  useEffect(() => {
    if (open) {
      const loadKeys = async () => {
        const keys: Record<string, boolean> = {};
        for (const p of PROVIDERS) {
          keys[p.id] = await hasApiKey(p.id);
        }
        setProviderKeys(keys);
      };
      loadKeys();
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setView("providers");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => {
          setOpen(!open);
          setView("providers");
          setSelectedProvider(null);
        }}
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

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 max-h-80 rounded-xl border border-border bg-surface shadow-xl shadow-black/30 z-50 overflow-hidden flex flex-col">
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
          {view === "providers" && !showKeyInput && (
            <div className="overflow-y-auto flex-1">
              {PROVIDERS.map((p) => {
                const hasKey = providerKeys[p.id] || false;
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProvider(p);
                            setShowKeyInput(true);
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors"
                        >
                          Setup
                        </button>
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
          )}

          {/* API Key Input */}
          {view === "providers" && showKeyInput && selectedProvider && (
            <div className="flex-1">
              <ApiKeyInput
                providerId={selectedProvider.id}
                providerName={selectedProvider.name}
                onKeySaved={() => {
                  setShowKeyInput(false);
                  setProviderKeys((prev) => ({ ...prev, [selectedProvider.id]: true }));
                  onApiKeyChange?.();
                }}
              />
              <button
                onClick={() => {
                  setShowKeyInput(false);
                  setSelectedProvider(null);
                }}
                className="w-full px-3 py-2 text-[12px] text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                ← Nazad na providere
              </button>
            </div>
          )}

          {/* Model list */}
          {view === "models" && selectedProvider && (
            <div className="overflow-y-auto flex-1">
              {selectedProvider.models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModelClick(m)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface-2 transition-colors ${
                    m.id === modelId && selectedProvider.id === providerId
                      ? "bg-surface-2"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] text-text truncate">{m.name}</span>
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
        </div>
      )}
    </div>
  );
}
