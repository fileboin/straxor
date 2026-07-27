import { useState, useEffect, useCallback } from "react";
import {
  fetchEnvs,
  createEnv,
  updateEnv,
  deleteEnv,
  fetchEnvHistory,
  validateEnvs,
  type EnvVar,
  type EnvHistoryEntry,
  type EnvValidationResult,
} from "../../lib/envs";

interface Props {
  projectId: string;
  onClose: () => void;
}

export default function EnvEditor({ projectId, onClose }: Props) {
  const [envs, setEnvs] = useState<EnvVar[]>([]);
  const [history, setHistory] = useState<EnvHistoryEntry[]>([]);
  const [validation, setValidation] = useState<EnvValidationResult | null>(null);
  const [tab, setTab] = useState<"envs" | "history">("envs");
  const [editing, setEditing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add/Edit form state
  const [formKey, setFormKey] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSecret, setFormSecret] = useState(false);
  const [formRequired, setFormRequired] = useState(false);

  const loadEnvs = useCallback(async () => {
    try {
      const data = await fetchEnvs(projectId);
      setEnvs(data);
    } catch {}
  }, [projectId]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await fetchEnvHistory(projectId);
      setHistory(data);
    } catch {}
  }, [projectId]);

  useEffect(() => {
    loadEnvs();
    loadHistory();
  }, [loadEnvs, loadHistory]);

  const handleAdd = async () => {
    setError(null);
    try {
      await createEnv(projectId, {
        key: formKey,
        value: formValue,
        description: formDesc || undefined,
        isSecret: formSecret,
        isRequired: formRequired,
      });
      setShowAdd(false);
      resetForm();
      loadEnvs();
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  const handleUpdate = async (envId: string) => {
    setError(null);
    try {
      await updateEnv(projectId, envId, {
        value: formValue,
        description: formDesc || undefined,
        isSecret: formSecret,
        isRequired: formRequired,
      });
      setEditing(null);
      resetForm();
      loadEnvs();
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  const handleDelete = async (envId: string) => {
    if (!confirm("Obrisati ovu varijablu?")) return;
    try {
      await deleteEnv(projectId, envId);
      loadEnvs();
      loadHistory();
    } catch {}
  };

  const handleValidate = async () => {
    try {
      const result = await validateEnvs(projectId);
      setValidation(result);
    } catch {}
  };

  const startEdit = (env: EnvVar) => {
    setEditing(env.id);
    setFormKey(env.key);
    setFormValue(env.rawValue);
    setFormDesc(env.description || "");
    setFormSecret(env.isSecret);
    setFormRequired(env.isRequired);
    setShowAdd(false);
    setError(null);
  };

  const resetForm = () => {
    setFormKey("");
    setFormValue("");
    setFormDesc("");
    setFormSecret(false);
    setFormRequired(false);
    setError(null);
  };

  const startAdd = () => {
    setShowAdd(true);
    setEditing(null);
    resetForm();
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString("hr-HR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const ACTION_LABELS: Record<string, string> = {
    create: "Kreirano",
    update: "Izmijenjeno",
    delete: "Obrisano",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-[700px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text">Environment Varijable</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleValidate}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-border bg-transparent text-text-secondary hover:text-text hover:border-border-light transition-colors"
            >
              Validiraj
            </button>
            <button
              onClick={onClose}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-border bg-transparent text-text-secondary hover:text-text hover:border-border-light transition-colors"
            >
              Zatvori
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab("envs")}
            className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === "envs"
                ? "text-text border-accent"
                : "text-text-muted border-transparent hover:text-text-secondary"
            }`}
          >
            Varijable ({envs.length})
          </button>
          <button
            onClick={() => setTab("history")}
            className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === "history"
                ? "text-text border-accent"
                : "text-text-muted border-transparent hover:text-text-secondary"
            }`}
          >
            Povijest
          </button>
        </div>

        {/* Validation errors */}
        {validation && !validation.valid && (
          <div className="mx-4 mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="text-[11px] font-medium text-red-400 mb-1">Greške:</div>
            {validation.errors.map((e, i) => (
              <div key={i} className="text-[11px] text-red-400/80">
                <span className="font-mono">{e.key}</span>: {e.error}
              </div>
            ))}
          </div>
        )}
        {validation && validation.valid && (
          <div className="mx-4 mt-3 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-[11px] text-green-400">
            Sve varijalde su valjane
          </div>
        )}

        {error && (
          <div className="mx-4 mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "envs" && (
            <div className="space-y-2">
              {/* Add button */}
              {!showAdd && editing === null && (
                <button
                  onClick={startAdd}
                  className="w-full py-2 text-[11px] font-medium rounded-lg border border-dashed border-border text-text-muted hover:text-text hover:border-accent transition-colors"
                >
                  + Dodaj varijablu
                </button>
              )}

              {/* Add form */}
              {showAdd && (
                <EnvForm
                  mode="add"
                  formKey={formKey}
                  formValue={formValue}
                  formDesc={formDesc}
                  formSecret={formSecret}
                  formRequired={formRequired}
                  onKeyChange={setFormKey}
                  onValueChange={setFormValue}
                  onDescChange={setFormDesc}
                  onSecretChange={setFormSecret}
                  onRequiredChange={setFormRequired}
                  onSubmit={handleAdd}
                  onCancel={() => { setShowAdd(false); resetForm(); }}
                />
              )}

              {/* Env list */}
              {envs.map((env) => (
                <div key={env.id}>
                  {editing === env.id ? (
                    <EnvForm
                      mode="edit"
                      formKey={formKey}
                      formValue={formValue}
                      formDesc={formDesc}
                      formSecret={formSecret}
                      formRequired={formRequired}
                      onValueChange={setFormValue}
                      onDescChange={setFormDesc}
                      onSecretChange={setFormSecret}
                      onRequiredChange={setFormRequired}
                      onSubmit={() => handleUpdate(env.id)}
                      onCancel={() => { setEditing(null); resetForm(); }}
                    />
                  ) : (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-border-light group transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium text-text">{env.key}</span>
                          {env.isSecret && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 font-medium">SECRET</span>
                          )}
                          {env.isRequired && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">REQUIRED</span>
                          )}
                        </div>
                        <div className="text-[11px] text-text-muted font-mono mt-0.5 truncate">
                          {env.value}
                        </div>
                        {env.description && (
                          <div className="text-[10px] text-text-muted mt-0.5">{env.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(env)}
                          className="px-2 py-1 text-[10px] rounded border border-border text-text-muted hover:text-text hover:border-border-light transition-colors"
                        >
                          Uredi
                        </button>
                        <button
                          onClick={() => handleDelete(env.id)}
                          className="px-2 py-1 text-[10px] rounded border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition-colors"
                        >
                          Obriši
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {envs.length === 0 && !showAdd && (
                <div className="text-center py-8 text-text-muted text-[11px]">
                  Nema environment varijabli. Klikni "+ Dodaj varijablu" za početak.
                </div>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-1">
              {history.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-[11px]">
                  Nema povijesti promjena.
                </div>
              ) : (
                history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-2 px-2 rounded hover:bg-surface-2 transition-colors"
                  >
                    <span className="text-[10px] text-text-muted shrink-0 sm:w-[120px]">
                      {formatTime(entry.createdAt)}
                    </span>
                    <span
                      className={`text-[10px] font-medium shrink-0 sm:w-[70px] ${
                        entry.action === "create"
                          ? "text-green-400"
                          : entry.action === "delete"
                          ? "text-red-400"
                          : "text-yellow-400"
                      }`}
                    >
                      {ACTION_LABELS[entry.action]}
                    </span>
                    <span className="font-mono text-[11px] text-text">{entry.key}</span>
                    {entry.action === "update" && entry.oldValue && entry.newValue && (
                      <span className="text-[10px] text-text-muted">
                        <span className="line-through">{entry.oldValue}</span>
                        {" → "}
                        <span>{entry.newValue}</span>
                      </span>
                    )}
                    {entry.action === "create" && entry.newValue && (
                      <span className="text-[10px] text-text-muted">= {entry.newValue}</span>
                    )}
                    {entry.action === "delete" && entry.oldValue && (
                      <span className="text-[10px] text-text-muted line-through">{entry.oldValue}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Inline form component
function EnvForm({
  mode,
  formKey,
  formValue,
  formDesc,
  formSecret,
  formRequired,
  onKeyChange,
  onValueChange,
  onDescChange,
  onSecretChange,
  onRequiredChange,
  onSubmit,
  onCancel,
}: {
  mode: "add" | "edit";
  formKey: string;
  formValue: string;
  formDesc: string;
  formSecret: boolean;
  formRequired: boolean;
  onKeyChange?: (v: string) => void;
  onValueChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onSecretChange: (v: boolean) => void;
  onRequiredChange: (v: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="p-3 rounded-lg border border-accent/30 bg-accent/5 space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        {mode === "add" && onKeyChange && (
          <input
            type="text"
            value={formKey}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder="KEY"
            className="flex-1 px-2 py-1.5 text-xs font-mono bg-bg border border-border rounded focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
          />
        )}
        {mode === "edit" && (
          <div className="flex-1 px-2 py-1.5 text-xs font-mono bg-bg border border-border rounded text-text-muted">
            {formKey}
          </div>
        )}
        <input
          type={formSecret ? "password" : "text"}
          value={formValue}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="Vrijednost"
          className="flex-[2] px-2 py-1.5 text-xs font-mono bg-bg border border-border rounded focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
        />
      </div>
      <input
        type="text"
        value={formDesc}
        onChange={(e) => onDescChange(e.target.value)}
        placeholder="Opis (opcionalno)"
        className="w-full px-2 py-1.5 text-[11px] bg-bg border border-border rounded focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
      />
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-[11px] text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={formSecret}
            onChange={(e) => onSecretChange(e.target.checked)}
            className="rounded border-border accent-accent"
          />
          Secret
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={formRequired}
            onChange={(e) => onRequiredChange(e.target.checked)}
            className="rounded border-border accent-accent"
          />
          Required
        </label>
        <div className="flex-1" />
        <button
          onClick={onCancel}
          className="px-2.5 py-1 text-[11px] rounded border border-border text-text-muted hover:text-text transition-colors"
        >
          Odustani
        </button>
        <button
          onClick={onSubmit}
          className="px-2.5 py-1 text-[11px] font-medium rounded border border-accent bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
        >
          {mode === "add" ? "Dodaj" : "Spremi"}
        </button>
      </div>
    </div>
  );
}
