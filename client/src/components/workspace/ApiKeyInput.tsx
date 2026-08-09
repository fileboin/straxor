import { useState, useEffect } from "react";
import { setApiKey, removeApiKey, hasApiKey } from "../../lib/chat.js";
import { t, useLang } from "../../lib/i18n.js";

interface Props {
  providerId: string;
  providerName: string;
  onKeySaved?: () => void;
}

export default function ApiKeyInput({ providerId, providerName, onKeySaved }: Props) {
  useLang();
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hasApiKey(providerId).then((exists) => {
      setHasExistingKey(exists);
      setLoading(false);
    });
  }, [providerId]);

  const handleSave = async () => {
    if (key.trim()) {
      await setApiKey(providerId, key.trim());
      setSaved(true);
      setHasExistingKey(true);
      onKeySaved?.();
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleRemove = async () => {
    await removeApiKey(providerId);
    setKey("");
    setHasExistingKey(false);
    setSaved(false);
  };

  if (loading) {
    return (
      <div className="px-3 py-2.5 border-b border-border bg-surface-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse shrink-0" />
          <span className="text-[11px] text-text-muted">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 border-b border-border bg-surface-2">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasExistingKey ? "bg-green-500" : "bg-yellow-500"}`} />
        <span className="text-[11px] text-text-muted">
          {hasExistingKey ? t("models.keyReady") : t("models.keyNeeded")}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex-1 relative">
          <input
            type={showKey ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={hasExistingKey ? "••••••••" : t("models.keyPlaceholder", { provider: providerName })}
            className="w-full px-2.5 py-1.5 text-[12px] rounded-lg border border-border bg-surface text-text placeholder-text-muted outline-none focus:border-accent transition-colors font-mono"
          />
        </div>
        <button
          onClick={() => setShowKey(!showKey)}
          className="px-2 py-1.5 text-[11px] rounded-lg border border-border bg-surface-3 text-text-muted hover:text-text transition-colors"
          title={showKey ? t("models.keyHide") : t("models.keyShow")}
        >
          {showKey ? "🙈" : "👁"}
        </button>
        {key.trim() && (
          <button
            onClick={handleSave}
            className={`px-2.5 py-1.5 text-[11px] rounded-lg border text-white transition-colors ${
              saved
                ? "border-green-500 bg-green-500"
                : "border-accent bg-accent hover:opacity-85"
            }`}
          >
            {saved ? "✓" : t("common.save")}
          </button>
        )}
      </div>
      {hasExistingKey && (
        <button
          onClick={handleRemove}
          className="mt-1.5 text-[10px] text-text-muted hover:text-danger transition-colors"
        >
          {t("common.delete")}
        </button>
      )}
    </div>
  );
}
