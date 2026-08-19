import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.js";
import { useTheme } from "../lib/theme.js";

type Tab = "preview" | "publish" | "deploy";

export default function DeployManager() {
  const { id: projectId } = useParams<{ id: string }>();
  const { logout } = useAuth();
  const { toggleTheme, theme } = useTheme();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("preview");

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-bold text-text">Publish & Deploy</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/project/${projectId}`)} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text">← Workspace</button>
          <button onClick={toggleTheme} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-text hover:bg-surface-2">{theme === "dark" ? "☀" : "☾"}</button>
          <button onClick={logout} className="text-[11px] text-text-muted hover:text-text">Logout</button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-44 shrink-0 border-r border-border bg-surface-2/50 overflow-y-auto">
          <nav className="p-2 space-y-0.5">
            {([
              ["preview", "👁", "Preview"],
              ["publish", "🔗", "Publish"],
              ["deploy", "🚀", "Deploy"],
            ] as const).map(([id, icon, label]) => (
              <button key={id} onClick={() => setTab(id as Tab)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors text-left ${tab === id ? "bg-accent/15 text-accent border border-accent/20" : "text-text-secondary hover:text-text hover:bg-surface-2 border border-transparent"}`}>
                <span>{icon}</span><span>{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div />
        </main>
      </div>
    </div>
  );
}
