import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../lib/auth.js";
import { Link } from "react-router-dom";
import { useTheme } from "../lib/theme.js";
import { t, useLang } from "../lib/i18n.js";
import { api } from "../lib/api.js";

export default function Register() {
  const { register } = useAuth();
  const { toggleTheme, theme } = useTheme();
  useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [noAdmin, setNoAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    api<{ adminExists: boolean; adminEmailConfigured: boolean }>("/auth/admin-status")
      .then((s) => {
        if (active) setNoAdmin(!s.adminExists);
      })
      .catch(() => {
        if (active) setNoAdmin(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password);
      setRegistered(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
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
            <span className="text-2xl font-extrabold tracking-tight text-accent">Straxor</span>
          </div>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl border border-border bg-surface-2 flex items-center justify-center text-text-secondary hover:text-text transition-colors"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
        <p className="text-sm text-text-secondary mb-6">AI-powered development platform</p>

        <div className="flex mb-6 border border-border rounded-xl overflow-hidden">
          <Link
            to="/login"
            className="flex-1 py-2 text-[13px] font-medium text-text-muted hover:text-text-secondary transition-colors text-center"
          >
            {t("auth.loginTab")}
          </Link>
          <button className="flex-1 py-2 text-[13px] font-medium bg-accent-dim text-accent">
            {t("auth.registerTab")}
          </button>
        </div>

        {noAdmin === true && (
          <div className="mb-4 flex items-start gap-2.5 bg-accent-dim border border-accent/30 rounded-xl p-3 text-[12px] text-accent leading-relaxed">
            <span className="text-base leading-none shrink-0 mt-0.5">👑</span>
            <span>{t("auth.firstAdmin")}</span>
          </div>
        )}

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
          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1.5">{t("auth.password")}</label>
            <input
              type="password"
              placeholder={t("auth.passwordMin")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors"
              required
            />
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-accent hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold transition-opacity"
          >
            {loading ? t("auth.registerLoading") : t("auth.registerTab")}
          </button>
        </form>
        {registered && (
          <div className="mt-4 bg-surface-2 border border-border rounded-xl p-4 text-[13px] text-text-muted leading-relaxed">
            📬 {t("auth.verificationNotice")}
          </div>
        )}
      </div>
    </div>
  );
}
