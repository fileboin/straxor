import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../lib/auth.js";
import {
  fetchProjects,
  createProject,
  deleteProject,
  type Project,
  type TemplateId,
} from "../lib/projects.js";
import TemplateSelector from "../components/TemplateSelector.js";
import BlueprintPreview from "../components/BlueprintPreview.js";

type Step = "info" | "template" | "blueprint";

export default function Dashboard() {
  const { user, logout } = useAuth();
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
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h1 className="text-lg font-bold">Straxor</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{user?.email}</span>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-300">
            Odjavi se
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Projekti</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            + Novi projekat
          </button>
        </div>

        {showCreate && (
          <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                {(["info", "template", "blueprint"] as Step[]).map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium ${
                        step === s
                          ? "bg-blue-600 text-white"
                          : i < ["info", "template", "blueprint"].indexOf(step)
                          ? "bg-gray-700 text-gray-300"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {i + 1}
                    </span>
                    {i < 2 && <div className="w-6 h-px bg-gray-700" />}
                  </div>
                ))}
              </div>
              <button
                onClick={resetCreate}
                className="text-gray-500 hover:text-gray-300 text-sm"
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
                    className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    autoFocus
                    required
                  />
                  <input
                    type="text"
                    placeholder="Opis (opcionalno)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors"
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
                      className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
                    >
                      ← Nazad
                    </button>
                    <button
                      onClick={handleNext}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors"
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
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleBack}
                      className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
                    >
                      ← Nazad
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={submitting}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
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
          <p className="text-gray-500">Učitavanje...</p>
        ) : projects.length === 0 ? (
          <p className="text-gray-500 text-center py-12">
            Nema projekata. Klikni "+ Novi projekat" za početak.
          </p>
        ) : (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 p-4 rounded-lg bg-gray-900 border border-gray-800"
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{p.name}</h3>
                  {p.description && (
                    <p className="text-sm text-gray-400 truncate">{p.description}</p>
                  )}
                </div>
                <span className="text-xs text-gray-600 shrink-0">{p.template}</span>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-sm text-gray-500 hover:text-red-500 transition-colors shrink-0"
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
