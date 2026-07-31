import { useState, type FormEvent } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useTheme } from "../lib/theme.js";
import { t, useLang } from "../lib/i18n.js";

export default function ResetPassword() {
  const { toggleTheme, theme } = useTheme();
  useLang();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Lozinka mora imati najmanje 6 karaktera");
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <p className="text-danger text-sm mb-4">{t("auth.resetInvalid")}</p>
          <Link to="/forgot-password" className="text-accent text-sm">{t("auth.requestNewLink")}</Link>
        </div>
      </div>
    );
  }

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

        {done ? (
          <div className="bg-surface-2 border border-border rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">✅</div>
            <h2 className="text-lg font-bold mb-2">{t("auth.resetDoneTitle")}</h2>
            <p className="text-sm text-text-muted mb-6">{t("auth.resetDoneSubtitle")}</p>
            <button
              onClick={() => navigate("/login")}
              className="w-full py-2.5 rounded-xl bg-accent hover:opacity-90 text-white text-sm font-semibold transition-opacity"
            >
              {t("auth.loginTab")}
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-2">{t("auth.newPassword")}</h2>
            <p className="text-sm text-text-muted mb-6">{t("auth.resetSubtitle")}</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">{t("auth.newPassword")}</label>
                <input
                  type="password"
                  placeholder={t("auth.passwordMin")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">{t("auth.confirmPassword")}</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
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
                {loading ? t("auth.saving") : t("auth.changePassword")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
