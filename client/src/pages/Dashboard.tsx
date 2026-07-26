import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../lib/auth.js";
import {
  fetchProjects,
  createProject,
  deleteProject,
  type Project,
} from "../lib/projects.js";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const project = await createProject(name, description || undefined);
      setProjects((prev) => [project, ...prev]);
      setName("");
      setDescription("");
      setShowCreate(false);
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
          <form onSubmit={handleCreate} className="mb-6 p-4 rounded-lg bg-gray-900 border border-gray-800 space-y-3">
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
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {submitting ? "Kreiranje..." : "Kreiraj"}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setError(""); }}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
              >
                Otkaži
              </button>
            </div>
          </form>
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
                className="flex items-center justify-between p-4 rounded-lg bg-gray-900 border border-gray-800"
              >
                <div>
                  <h3 className="font-medium">{p.name}</h3>
                  {p.description && (
                    <p className="text-sm text-gray-400 mt-1">{p.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-sm text-gray-500 hover:text-red-500 transition-colors"
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
