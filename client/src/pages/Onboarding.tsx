import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { completeOnboarding, ONBOARDING_STEPS, type OnboardingStep } from "../lib/onboarding";
import { setApiKey } from "../lib/chat";
import { useAuth } from "../lib/auth";

const PROVIDERS = [
  { id: "anthropic", name: "Anthropic" },
  { id: "openai", name: "OpenAI" },
  { id: "google", name: "Google" },
  { id: "deepseek", name: "DeepSeek" },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stepIdx, setStepIdx] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStep>>(new Set());
  const current = ONBOARDING_STEPS[stepIdx];

  const markComplete = (step: OnboardingStep) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
  };

  const goNext = () => {
    if (stepIdx < ONBOARDING_STEPS.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      completeOnboarding();
      navigate("/");
    }
  };

  const goPrev = () => {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  };

  const handleFinish = () => {
    completeOnboarding();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-text mb-1">Dobrodošao u Straxor</h1>
          <p className="text-sm text-text-muted">
            Postavi svoj prostor u par koraka
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {ONBOARDING_STEPS.map((s, i) => {
            const isActive = i === stepIdx;
            const isDone = completedSteps.has(s.id);
            return (
              <div key={s.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                      isDone
                        ? "bg-accent border-accent text-white"
                        : isActive
                        ? "border-accent text-accent bg-accent/10"
                        : "border-border text-text-muted bg-surface"
                    }`}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span
                    className={`text-[10px] mt-1.5 font-medium ${
                      isActive ? "text-accent" : isDone ? "text-text-secondary" : "text-text-muted"
                    }`}
                  >
                    {s.tagline}
                  </span>
                </div>
                {i < ONBOARDING_STEPS.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-2 mt-[-14px] rounded ${
                      isDone ? "bg-accent" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="bg-surface border border-border rounded-xl p-6 mb-6 min-h-[280px]">
                  {current.id === "ai-key" && (
            <StepAiKey onComplete={() => markComplete("ai-key")} />
          )}
          {current.id === "vps" && (
            <StepVps onComplete={() => markComplete("vps")} />
          )}
          {current.id === "git" && (
            <StepGit onComplete={() => markComplete("git")} />
          )}
          {current.id === "project" && (
            <StepProject onComplete={() => markComplete("project")} user={user} />
          )}
          {current.id === "api-token" && (
            <StepApiToken onComplete={() => markComplete("api-token")} />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={stepIdx === 0}
            className="px-4 py-2 text-sm text-text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Nazad
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={goNext}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-transparent text-text-secondary hover:text-text hover:border-border-light transition-colors"
            >
              Preskoči
            </button>
            {completedSteps.has(current.id) ? (
              <button
                onClick={stepIdx === ONBOARDING_STEPS.length - 1 ? handleFinish : goNext}
                className="px-5 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:opacity-90 transition-opacity"
              >
                {stepIdx === ONBOARDING_STEPS.length - 1 ? "Završi" : "Dalje"}
              </button>
            ) : (
              <button
                onClick={goNext}
                className="px-5 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:opacity-90 transition-opacity"
              >
                Dalje
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Step 1: AI Key --- */
function StepAiKey({ onComplete }: { onComplete: () => void }) {
  const [selected, setSelected] = useState("anthropic");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!key.trim()) return;
    await setApiKey(selected, key.trim());
    setSaved(true);
    onComplete();
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-text mb-1">AI Ključ</h2>
      <p className="text-[11px] text-text-muted mb-4">
        Unesi API key za svog AI providera. Tvoji ključevi — tvoji podaci.
      </p>

      <div className="flex gap-1.5 mb-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${
              selected === p.id
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type={showKey ? "text" : "password"}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={`Unesi ${PROVIDERS.find((p) => p.id === selected)?.name} API key...`}
          className="flex-1 px-3 py-2 text-xs font-mono bg-bg border border-border rounded-lg focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
        />
        <button
          onClick={() => setShowKey(!showKey)}
          className="px-2.5 py-2 text-xs rounded-lg border border-border bg-surface-2 text-text-muted hover:text-text transition-colors"
        >
          {showKey ? "🙈" : "👁"}
        </button>
      </div>

      {key.trim() && (
        <button
          onClick={handleSave}
          className={`mt-3 w-full py-2 text-xs font-medium rounded-lg border transition-colors ${
            saved
              ? "border-green-500 bg-green-500/10 text-green-400"
              : "border-accent bg-accent/10 text-accent hover:bg-accent/20"
          }`}
        >
          {saved ? "✓ Spremljeno" : "Spremi key"}
        </button>
      )}
    </div>
  );
}

/* --- Step 2: VPS --- */
function StepVps({ onComplete }: { onComplete: () => void }) {
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [done, setDone] = useState(false);

  const handleSave = () => {
    onComplete();
    setDone(true);
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-text mb-1">VPS Povezivanje</h2>
      <p className="text-[11px] text-text-muted mb-4">
        Poveži svoj server. Moja infrastruktura — moji resursi.
      </p>

      <div className="space-y-2.5">
        <input
          type="text"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="hostname ili IP (npr. 192.168.1.1)"
          className="w-full px-3 py-2 text-xs font-mono bg-bg border border-border rounded-lg focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
        />
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username (npr. root)"
          className="w-full px-3 py-2 text-xs font-mono bg-bg border border-border rounded-lg focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
        />
      </div>

      <p className="text-[10px] text-text-muted mt-3">
        Detalje možeš kasnije dodati iz Workspace-a.
      </p>

      {host && username && !done && (
        <button
          onClick={handleSave}
          className="mt-3 w-full py-2 text-xs font-medium rounded-lg border border-accent bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
        >
          Spremi
        </button>
      )}
      {done && (
        <div className="mt-3 text-center text-[11px] text-green-400 font-medium">
          ✓ Spremljeno — možeš nastaviti
        </div>
      )}
    </div>
  );
}

/* --- Step 3: Git --- */
function StepGit({ onComplete }: { onComplete: () => void }) {
  const [provider, setProvider] = useState("github");
  const [done, setDone] = useState(false);

  const handleSave = () => {
    onComplete();
    setDone(true);
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-text mb-1">Git Povezivanje</h2>
      <p className="text-[11px] text-text-muted mb-4">
        Poveži svoj Git repozitorij. Moj kod — moja kontrola.
      </p>

      <div className="flex gap-1.5 mb-4">
        {["github", "gitlab", "bitbucket"].map((p) => (
          <button
            key={p}
            onClick={() => setProvider(p)}
            className={`px-3 py-2 text-[11px] font-medium rounded-lg border transition-colors ${
              provider === p
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div className="p-3 rounded-lg bg-surface-2 border border-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
          <span className="text-[11px] text-text-secondary font-medium">
            {provider === "github" ? "GitHub" : provider === "gitlab" ? "GitLab" : "Bitbucket"} integracija
          </span>
        </div>
        <p className="text-[10px] text-text-muted">
          Token i repo povezivanje bit će dostupni u Settings sekciji nakon onboardinga.
        </p>
      </div>

      {!done && (
        <button
          onClick={handleSave}
          className="mt-3 w-full py-2 text-xs font-medium rounded-lg border border-accent bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
        >
          Nastavi
        </button>
      )}
      {done && (
        <div className="mt-3 text-center text-[11px] text-green-400 font-medium">
          ✓ Spremljeno — možeš nastaviti
        </div>
      )}
    </div>
  );
}

/* --- Step 2.5: API Token after Coolify install --- */
function StepApiToken({ onComplete }: { onComplete: () => void }) {
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!token.trim()) return;
    // Persist token locally for the onboarding session
    localStorage.setItem("straxor.coolify_token", token.trim());
    setSaved(true);
    onComplete();
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-text mb-1">Coolify API Token</h2>
      <p className="text-[11px] text-text-muted mb-4">Unesi API token za Coolify kako bi završili post-instacijsku tok...</p>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Token"
        className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-lg focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
      />
      {!saved ? (
        <button
          onClick={handleSave}
          className="mt-3 w-full py-2 text-xs font-medium rounded-lg border border-accent bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
        >
          Spremi token
        </button>
      ) : (
        <div className="mt-2 text-green-600 text-xs">Token spremljen</div>
      )}
    </div>
  );
}

/* --- Step 4: First Project --- */
function StepProject({ onComplete, user }: { onComplete: () => void; user: { id: string; email: string } | null }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [done, setDone] = useState(false);

  const handleCreate = () => {
    if (!name.trim()) return;
    // Project creation happens via the normal flow after onboarding
    onComplete();
    setDone(true);
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-text mb-1">Prvi Projekt</h2>
      <p className="text-[11px] text-text-muted mb-4">
        Kreiraj svoj prvi projekt i počni graditi.
      </p>

      <div className="space-y-2.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Naziv projekta (npr. moj-app)"
          className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-lg focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Kratki opis (opcionalno)"
          rows={2}
          className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-lg focus:outline-none focus:border-accent text-text placeholder:text-text-muted resize-none"
        />
      </div>

      {user && (
        <p className="text-[10px] text-text-muted mt-2">
          Projekt će biti povezan s: <span className="font-mono">{user.email}</span>
        </p>
      )}

      {name.trim() && !done && (
        <button
          onClick={handleCreate}
          className="mt-3 w-full py-2 text-xs font-medium rounded-lg border border-accent bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
        >
          Kreiraj projekt
        </button>
      )}
      {done && (
        <div className="mt-3 text-center text-[11px] text-green-400 font-medium">
          ✓ Projekt spreman — završi onboarding
        </div>
      )}
    </div>
  );
}
