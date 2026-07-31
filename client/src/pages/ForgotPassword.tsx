import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useTheme } from "../lib/theme.js";
import { t, useLang } from "../lib/i18n.js";

export default function ForgotPassword() {
  const { toggleTheme, theme } = useTheme();
  useLang();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus("loading");
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setStatus("idle");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center font-extrabold text-white text-sm">
              S
            </div>
            <span className="text-2xl font-extrabold tracking-tight">Straxor</span>
          </div>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl border border-border bg-surface-2 flex items-center justify-center text-text-secondary hover:text-text transition-colors"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>

        <Link to="/login" className="text-sm text-text-muted hover:text-text-secondary transition-colors mb-6 inline-block">
          ← {t("auth.backToLogin")}
        </Link>

        {status === "sent" ? (
          <div className="bg-surface-2 border border-border rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">📬</div>
            <h2 className="text-lg font-bold mb-2">{t("auth.checkEmail")}</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              {t("auth.resetSent")}
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-2">{t("auth.forgotTitle")}</h2>
            <p className="text-sm text-text-muted mb-6">
              {t("auth.forgotSubtitle")}
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">{t("auth.email")}</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors"
                  required
                />
              </div>
              {error && <p className="text-danger text-sm">{error}</p>}
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full py-2.5 rounded-xl bg-accent hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold transition-opacity"
              >
                {status === "loading" ? t("auth.sending") : t("auth.sendLink")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
