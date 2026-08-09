import { useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth.js";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useTheme } from "../lib/theme.js";
import { t, useLang } from "../lib/i18n.js";

export default function Login() {
  const { login } = useAuth();
  const { toggleTheme, theme } = useTheme();
  const location = useLocation();
  const [params] = useSearchParams();
  useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const oauthError = useMemo(() => {
    if (params.get("oauth") !== "error") return "";
    return params.get("message") || "GitHub prijava nije uspjela";
  }, [params]);
  const githubLoginHref = useMemo(() => {
    const returnTo = location.state && typeof location.state === 'object' && 'from' in location.state
      ? String((location.state as { from?: string }).from || '/')
      : '/';
    return `/api/auth/github?returnTo=${encodeURIComponent(returnTo)}`;
  }, [location.state]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
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
          <button className="flex-1 py-2 text-[13px] font-medium bg-accent-dim text-accent">
            {t("auth.loginTab")}
          </button>
          <Link
            to="/register"
            className="flex-1 py-2 text-[13px] font-medium text-text-muted hover:text-text-secondary transition-colors text-center"
          >
            {t("auth.registerTab")}
          </Link>
        </div>

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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors"
              required
            />
          </div>
          {(error || oauthError) && <p className="text-danger text-sm">{error || oauthError}</p>}
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-[13px] text-text-muted hover:text-accent transition-colors">
              {t("auth.forgot")}
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-accent hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold transition-opacity"
          >
            {loading ? t("auth.loginLoading") : t("auth.loginTab")}
          </button>
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-[0.18em] text-text-muted">
              <span className="bg-background px-2">or</span>
            </div>
          </div>
          <a
            href={githubLoginHref}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 text-text text-sm font-semibold transition-colors"
          >
            <span aria-hidden="true">🐙</span>
            <span>Continue with GitHub</span>
          </a>
        </form>
      </div>
    </div>
  );
}
