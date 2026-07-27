import { useNavigate } from "react-router-dom";
import { useTheme } from "../../lib/theme.js";
import HomeMenu from "./HomeMenu.js";

interface Props {
  projectName: string;
  template: string;
  status?: "idle" | "active";
  orchestrator: boolean;
  onOrchestratorChange: (value: boolean) => void;
  vpsStatus?: "disconnected" | "connecting" | "provisioning" | "ready" | "error";
  onConnectVps?: () => void;
  onOpenEnv?: () => void;
  onOpenDeploy?: () => void;
  onOpenHowItWorks?: () => void;
  onOpenSettings?: () => void;
}

const VPS_STATUS_LABELS: Record<string, string> = {
  disconnected: "SSH",
  connecting: "Spajanje...",
  provisioning: "Provisioning...",
  ready: "VPS ✓",
  error: "VPS ✕",
};

const VPS_STATUS_COLORS: Record<string, string> = {
  disconnected: "border-border bg-transparent text-text-secondary",
  connecting: "border-yellow-500/50 bg-yellow-500/10 text-yellow-500",
  provisioning: "border-accent/50 bg-accent-dim text-accent",
  ready: "border-green-500/50 bg-green-500/10 text-green-500",
  error: "border-red-500/50 bg-red-500/10 text-red-500",
};

export default function WorkspaceTopbar({
  projectName,
  template,
  status = "idle",
  orchestrator,
  onOrchestratorChange,
  vpsStatus = "disconnected",
  onConnectVps,
  onOpenEnv,
  onOpenDeploy,
  onOpenHowItWorks,
  onOpenSettings,
}: Props) {
  const navigate = useNavigate();
  const { toggleTheme, theme } = useTheme();

  return (
    <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface h-11 shrink-0 md:px-4">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => navigate("/")}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-transparent text-text-secondary hover:text-text hover:border-border-light transition-colors shrink-0"
        >
          ←
        </button>
        <span className="font-semibold text-sm truncate">{projectName}</span>
        <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface-3 text-text-muted shrink-0">
          {template}
        </span>
        {status === "active" && (
          <>
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
            <span className="text-xs text-text-muted hidden sm:inline">Agent aktivan</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Orkestrator toggle */}
        <button
          onClick={() => onOrchestratorChange(!orchestrator)}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            orchestrator
              ? "border-accent-border bg-accent-dim text-accent"
              : "border-border bg-transparent text-text-muted hover:text-text-secondary hover:border-border-light"
          }`}
          title={orchestrator ? "Orkestrator uključen — AI rutira modele po složenosti" : "Orkestrator isključen — ručni izbor modela"}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${orchestrator ? "bg-accent" : "bg-text-muted"}`} />
          <span className="hidden lg:inline">Orch</span>
        </button>

        <button
          onClick={toggleTheme}
          className="px-2.5 py-1.5 rounded-lg border border-border bg-surface-3 text-text-secondary text-xs hover:text-text transition-colors"
          title={theme === "dark" ? "Light tema" : "Dark tema"}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>

        {/* Connect VPS button */}
        <button
          onClick={onConnectVps}
          disabled={vpsStatus === "connecting" || vpsStatus === "provisioning"}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${VPS_STATUS_COLORS[vpsStatus]} disabled:opacity-50 disabled:cursor-not-allowed`}
          title={vpsStatus === "ready" ? "VPS povezan" : "Poveži VPS"}
        >
          {(vpsStatus === "connecting" || vpsStatus === "provisioning") && (
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse shrink-0" />
          )}
          <span className="hidden lg:inline">{VPS_STATUS_LABELS[vpsStatus]}</span>
        </button>

        <button
          onClick={onOpenEnv}
          className="hidden sm:flex px-2.5 py-1.5 rounded-lg border border-border bg-transparent text-text-secondary text-xs hover:text-text transition-colors"
        >
          .env
        </button>
        <button
          onClick={onOpenDeploy}
          className="hidden sm:flex px-2.5 py-1.5 rounded-lg border border-border bg-transparent text-text-secondary text-xs hover:text-text transition-colors"
        >
          Deploy
        </button>
        <HomeMenu
          onOpenHowItWorks={onOpenHowItWorks}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </header>
  );
}
