import { useState, useEffect } from "react";
import {
  fetchPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  PROMPT_CATEGORIES,
  type SavedPrompt,
} from "../../lib/roles.js";

interface Props {
  projectId?: string;
  onSelect?: (prompt: SavedPrompt) => void;
}

export default function PromptLibrary({ projectId, onSelect }: Props) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<SavedPrompt | null>(null);

  // Create/edit form state
  const [formName, setFormName] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<string>("instruction");
  const [formGlobal, setFormGlobal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchPrompts(projectId);
      setPrompts(data);
    } catch {
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === "all" ? prompts : prompts.filter((p) => p.category === filter);

  function openCreate() {
    setEditing(null);
    setFormName("");
    setFormContent("");
    setFormCategory("instruction");
    setFormGlobal(!projectId);
    setShowCreate(true);
  }

  function openEdit(p: SavedPrompt) {
    setEditing(p);
    setFormName(p.name);
    setFormContent(p.content);
    setFormCategory(p.category);
    setFormGlobal(p.isGlobal);
    setShowCreate(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formContent.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updatePrompt(editing.id, {
          name: formName,
          content: formContent,
          category: formCategory,
          isGlobal: formGlobal,
        });
      } else {
        await createPrompt({
          name: formName,
          content: formContent,
          category: formCategory,
          projectId,
          isGlobal: formGlobal,
        });
      }
      setShowCreate(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deletePrompt(id);
    await load();
  }

  const globalCount = prompts.filter((p) => p.isGlobal).length;
  const projectCount = prompts.filter((p) => !p.isGlobal).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-text">Prompt Library</span>
          <span className="text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded">
            {prompts.length}
          </span>
        </div>
        <button
          onClick={openCreate}
          className="text-[11px] text-accent hover:text-accent-light px-2 py-1 rounded hover:bg-surface-2 transition-colors"
        >
          + Novi
        </button>
      </div>

      {/* Category filter tabs */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border overflow-x-auto shrink-0">
        <button
          onClick={() => setFilter("all")}
          className={`text-[10px] px-2 py-1 rounded-md whitespace-nowrap transition-colors ${
            filter === "all"
              ? "bg-accent-dim text-accent"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Svi ({prompts.length})
        </button>
        {PROMPT_CATEGORIES.map((cat) => {
          const count = prompts.filter((p) => p.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={`text-[10px] px-2 py-1 rounded-md whitespace-nowrap transition-colors ${
                filter === cat.id
                  ? "bg-accent-dim text-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {cat.icon} {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Prompt list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && (
          <div className="text-center py-8 text-text-muted text-[11px]">
            Učitavam promptove...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-8">
            <div className="text-text-muted text-[11px]">
              {prompts.length === 0
                ? "Nema sačuvanih promptova"
                : "Nema promptova u ovoj kategoriji"}
            </div>
            <button
              onClick={openCreate}
              className="text-[11px] text-accent hover:text-accent-light mt-2"
            >
              + Kreiraj prvi prompt
            </button>
          </div>
        )}

        {!loading &&
          filtered.map((p) => {
            const cat = PROMPT_CATEGORIES.find((c) => c.id === p.category);
            return (
              <div
                key={p.id}
                className="group rounded-lg border border-border bg-surface p-2.5 hover:border-border-light transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-text truncate">
                        {p.name}
                      </span>
                      <span className="text-[9px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded shrink-0">
                        {cat?.icon} {cat?.label}
                      </span>
                      {p.isGlobal && (
                        <span className="text-[9px] text-accent bg-accent-dim px-1.5 py-0.5 rounded shrink-0">
                          global
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-text-muted mt-1 line-clamp-2 leading-relaxed">
                      {p.content}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onSelect && (
                      <button
                        onClick={() => onSelect(p)}
                        className="text-[10px] text-accent hover:text-accent-light px-1.5 py-0.5 rounded hover:bg-surface-2"
                        title="Umetni u poruku"
                      >
                        ⚡
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(p)}
                      className="text-[10px] text-text-muted hover:text-text px-1.5 py-0.5 rounded hover:bg-surface-2"
                      title="Uredi"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-[10px] text-text-muted hover:text-accent-red px-1.5 py-0.5 rounded hover:bg-surface-2"
                      title="Obriši"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Summary */}
      <div className="px-3 py-1.5 border-t border-border text-[9px] text-text-muted flex gap-3 shrink-0">
        <span>globalni: {globalCount}</span>
        <span>projektni: {projectCount}</span>
      </div>

      {/* Create/Edit modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[500px] mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-[13px] font-semibold text-text">
                {editing ? "Uredi prompt" : "Novi prompt"}
              </span>
              <button
                onClick={() => setShowCreate(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wider font-medium mb-1 block">
                  Ime
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="npr. Code Style Rules"
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[12px] text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wider font-medium mb-1 block">
                  Sadržaj
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Upute ili pravila koja agent treba slijediti..."
                  rows={5}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[12px] text-text placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-text-muted uppercase tracking-wider font-medium mb-1 block">
                    Kategorija
                  </label>
                  <div className="flex gap-1">
                    {PROMPT_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setFormCategory(cat.id)}
                        className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                          formCategory === cat.id
                            ? "bg-accent-dim text-accent"
                            : "bg-surface-2 text-text-muted hover:text-text-secondary"
                        }`}
                      >
                        {cat.icon}
                      </button>
                    ))}
                  </div>
                </div>

                {projectId && (
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                      Global
                    </label>
                    <button
                      onClick={() => setFormGlobal(!formGlobal)}
                      className={`w-8 h-[18px] rounded-full transition-colors ${
                        formGlobal ? "bg-accent" : "bg-surface-2 border border-border"
                      } relative`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full absolute top-[2px] transition-transform ${
                          formGlobal
                            ? "left-[16px] bg-white"
                            : "left-[2px] bg-text-muted"
                        }`}
                      />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
              <button
                onClick={() => setShowCreate(false)}
                className="text-[11px] text-text-muted hover:text-text px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors"
              >
                Otkaži
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formContent.trim()}
                className="text-[11px] text-white bg-accent hover:bg-accent-light px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
              >
                {saving ? "Spremam..." : editing ? "Spremi" : "Kreiraj"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
