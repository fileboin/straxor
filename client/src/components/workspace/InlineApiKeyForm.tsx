import { useEffect, useRef, useState } from "react";
import { setApiKey } from "../../lib/chat.js";
import { t } from "../../lib/i18n.js";

interface Props {
  providerId: string;
  providerName: string;
  autoFocus?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
}

export default function InlineApiKeyForm({
  providerId,
  providerName,
  autoFocus,
  onSaved,
  onCancel,
}: Props) {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const handleSave = async () => {
    const k = key.trim();
    if (!k) return;
    setSaving(true);
    setError("");
    try {
      await setApiKey(providerId, k);
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-3 py-2 bg-surface-3 border-b border-border">
      <div className="text-[11px] font-medium text-text-secondary mb-1.5">
        {providerName} — {t("models.keyNeeded")}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          placeholder={t("models.keyPlaceholder", { provider: providerName })}
          autoComplete="off"
          className="flex-1 min-w-0 px-2.5 py-1.5 text-[12px] rounded-lg border border-border bg-surface text-text placeholder-text-muted outline-none focus:border-accent transition-colors font-mono"
        />
        <button
          onClick={handleSave}
          disabled={!key.trim() || saving}
          className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-colors disabled:opacity-40 ${
            saved
              ? "border-green-500 bg-green-500 text-white"
              : "border-accent bg-accent text-white hover:opacity-85"
          }`}
        >
          {saving ? "…" : saved ? "✓" : t("common.save")}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-2 py-1.5 text-[11px] rounded-lg border border-border bg-surface-3 text-text-muted hover:text-text transition-colors"
            title={t("common.cancel")}
          >
            ✕
          </button>
        )}
      </div>
      {error && <div className="mt-1 text-[10px] text-red-500">{error}</div>}
    </div>
  );
}
