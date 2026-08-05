import { useState, useEffect, type FormEvent } from "react";
import { useAuth, isAdmin } from "../lib/auth.js";
import { useTheme } from "../lib/theme.js";
import {
  fetchProjects,
  createProject,
  deleteProject,
  type Project,
  type TemplateId,
} from "../lib/projects.js";
import TemplateSelector from "../components/TemplateSelector.js";
import BlueprintPreview from "../components/BlueprintPreview.js";
import { useNavigate } from "react-router-dom";

type Step = "info" | "template" | "blueprint";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { toggleTheme, theme } = useTheme();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<TemplateId>("empty");
  const [color, setColor] = useState("#3b82f6");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  const resetCreate = () => {
    setShowCreate(false);
    setStep("info");
    setName("");
    setDescription("");
    setTemplate("empty");
    setColor("#3b82f6");
    setError("");
  };

  const handleNext = () => {
    if (step === "info") setStep("template");
    else if (step === "template") setStep("blueprint");
  };

  const handleBack = () => {
    if (step === "template") setStep("info");
    else if (step === "blueprint") setStep("template");
  };

  const handleCreate = async () => {
    setError("");
    setSubmitting(true);
    try {
      const project = await createProject(
        name,
        description || undefined,
        template,
        color
      );
      setProjects((prev) => [project, ...prev]);
      resetCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Greška");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <h1 className="text-lg font-bold text-accent">Straxor</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg border border-border bg-surface-2 flex items-center justify-center text-text-secondary hover:text-text transition-colors text-sm"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          {isAdmin(user) && (
            <button onClick={() => navigate("/admin")} className="text-sm px-3 py-1.5 rounded-lg bg-surface-2 border border-accent/30 text-accent hover:bg-accent/10 transition-colors">
              Admin
            </button>
          )}
          <button onClick={() => navigate("/connections")} className="text-sm px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text transition-colors">
            Connections
          </button>
          <button onClick={() => navigate("/marketplace")} className="text-sm px-3 py-1.5 rounded-lg bg-surface-2 border border-accent/30 text-accent hover:bg-accent/10 transition-colors">
            Marketplace
          </button>
          <button onClick={() => navigate("/help")} className="text-sm px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text transition-colors">
            Help
          </button>
          <span className="text-sm text-text-secondary hidden sm:inline">{user?.email}</span>
          <button onClick={logout} className="text-sm text-text-muted hover:text-text transition-colors">
            Odjavi se
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Projekti</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-xl bg-accent hover:opacity-90 text-sm font-semibold text-white transition-opacity"
          >
            + Novi projekat
          </button>
        </div>

        {showCreate && (
          <div className="mb-6 rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                {(["info", "template", "blueprint"] as Step[]).map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium ${
                        step === s
                          ? "bg-accent text-white"
                          : i < ["info", "template", "blueprint"].indexOf(step)
                          ? "bg-surface-3 text-text-secondary"
                          : "bg-surface-2 text-text-muted"
                      }`}
                    >
                      {i + 1}
                    </span>
                    {i < 2 && <div className="w-6 h-px bg-border" />}
                  </div>
                ))}
              </div>
              <button
                onClick={resetCreate}
                className="text-text-muted hover:text-text text-sm transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              {step === "info" && (
                <form
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    handleNext();
                  }}
                  className="space-y-3"
                >
                  <input
                    type="text"
                    placeholder="Naziv projekta"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-border text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors"
                    autoFocus
                    required
                  />
                  <input
                    type="text"
                    placeholder="Opis (opcionalno)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-border text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-accent hover:opacity-90 text-sm font-semibold text-white transition-opacity"
                  >
                    Dalje →
                  </button>
                </form>
              )}

              {step === "template" && (
                <div className="space-y-3">
                  <TemplateSelector selected={template} onSelect={setTemplate} />
                  <div className="flex gap-2">
                    <button
                      onClick={handleBack}
                      className="px-4 py-2 rounded-xl bg-surface-3 hover:bg-border text-sm text-text-secondary transition-colors"
                    >
                      ← Nazad
                    </button>
                    <button
                      onClick={handleNext}
                      className="px-4 py-2 rounded-xl bg-accent hover:opacity-90 text-sm font-semibold text-white transition-opacity"
                    >
                      Dalje →
                    </button>
                  </div>
                </div>
              )}

              {step === "blueprint" && (
                <div className="space-y-4">
                  <BlueprintPreview
                    name={name}
                    description={description}
                    template={template}
                    color={color}
                    onColorChange={setColor}
                  />
                  {error && <p className="text-danger text-sm">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleBack}
                      className="px-4 py-2 rounded-xl bg-surface-3 hover:bg-border text-sm text-text-secondary transition-colors"
                    >
                      ← Nazad
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={submitting}
                      className="px-4 py-2 rounded-xl bg-accent hover:opacity-90 disabled:opacity-50 text-sm font-semibold text-white transition-opacity"
                    >
                      {submitting ? "Kreiranje..." : "Potvrdi i kreiraj"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-text-muted">Učitavanje...</p>
        ) : projects.length === 0 ? (
          <p className="text-text-muted text-center py-12">
            Nema projekata. Klikni "+ Novi projekat" za početak.
          </p>
        ) : (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li
                key={p.id}
                onClick={() => navigate(`/project/${p.id}`)}
                className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface hover:bg-surface-2 cursor-pointer transition-colors"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{p.name}</h3>
                  {p.description && (
                    <p className="text-xs text-text-muted truncate">{p.description}</p>
                  )}
                </div>
                <span className="text-[11px] text-text-muted px-2 py-0.5 rounded-md bg-surface-3 shrink-0">
                  {p.template}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/project/${p.id}/deploy`);
                  }}
                  className="text-[11px] px-2 py-1 rounded-lg bg-surface-3 text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors shrink-0"
                >
                  🚀
                </button>
                <span className="text-text-muted text-sm shrink-0">→</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(p.id);
                  }}
                  className="text-sm text-text-muted hover:text-danger transition-colors shrink-0"
                >
                  Obriši
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
