import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.js";

export default function GitHubAuthCallback() {
  const { completeOAuthLogin } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const run = async () => {
      const oauth = params.get("oauth");
      const token = params.get("token");
      const message = params.get("message") || "GitHub prijava nije uspjela";

      if (oauth !== "success" || !token) {
        if (active) {
          setError(message);
          navigate(`/login?oauth=error&message=${encodeURIComponent(message)}`, { replace: true });
        }
        return;
      }

      try {
        await completeOAuthLogin(token);
        if (active) navigate("/", { replace: true });
      } catch (err) {
        const text = err instanceof Error ? err.message : "GitHub prijava nije uspjela";
        if (active) {
          setError(text);
          navigate(`/login?oauth=error&message=${encodeURIComponent(text)}`, { replace: true });
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [completeOAuthLogin, navigate, params]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center">
        <div className="text-lg font-semibold text-text">GitHub prijava u toku…</div>
        <p className="mt-2 text-sm text-text-secondary">
          {error || "Završavamo OAuth prijavu i vraćamo te u aplikaciju."}
        </p>
      </div>
    </div>
  );
}
