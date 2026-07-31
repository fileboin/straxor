import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useTheme } from "../lib/theme.js";

export default function VerifyEmail() {
  const { toggleTheme, theme } = useTheme();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Neispravan verifikacioni link.");
      return;
    }
    api<{ message?: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Greška");
      });
  }, [token]);

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

        <div className="bg-surface-2 border border-border rounded-xl p-6 text-center">
          {status === "loading" && (
            <>
              <div className="text-3xl mb-3">⏳</div>
              <p className="text-sm text-text-muted">Verifikacija u toku...</p>
            </>
          )}
          {status === "success" && (
            <>
              <div className="text-3xl mb-3">✅</div>
              <h2 className="text-lg font-bold mb-2">Email potvrđen</h2>
              <p className="text-sm text-text-muted mb-6">Vaša email adresa je uspješno potvrđena.</p>
              <Link
                to="/login"
                className="inline-block w-full py-2.5 rounded-xl bg-accent hover:opacity-90 text-white text-sm font-semibold transition-opacity text-center"
              >
                Prijavi se
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <div className="text-3xl mb-3">⚠️</div>
              <h2 className="text-lg font-bold mb-2">Verifikacija nije uspjela</h2>
              <p className="text-sm text-danger mb-6">{error}</p>
              <Link
                to="/login"
                className="text-sm text-accent"
              >
                Nazad na prijavu
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
