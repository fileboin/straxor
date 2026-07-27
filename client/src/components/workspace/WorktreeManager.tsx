import { useState, useEffect } from "react";
import {
  fetchWorktrees,
  createWorktree,
  removeWorktree,
  mergeWorktree,
  getWorktreeStatus,
  type Worktree,
  type GitStatus,
  STATUS_COLORS,
  STATUS_BG,
} from "../../lib/worktrees.js";

interface Props {
  machineId: string;
  onClose: () => void;
}

export default function WorktreeManager({ machineId, onClose }: Props) {
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newBranch, setNewBranch] = useState("");
  const [newTask, setNewTask] = useState("");
  const [fromBranch, setFromBranch] = useState("main");
  const [creating, setCreating] = useState(false);

  // Selected worktree for detail view
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<GitStatus[]>([]);
  const [merging, setMerging] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [machineId]);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchWorktrees(machineId);
      setWorktrees(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newBranch.trim()) return;
    setCreating(true);
    try {
      const branchName = newBranch.trim().toLowerCase().replace(/\s+/g, "-");
      await createWorktree(machineId, branchName, fromBranch, newTask || undefined);
      setShowCreate(false);
      setNewBranch("");
      setNewTask("");
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(id: string) {
    setRemoving(id);
    try {
      await removeWorktree(id);
      if (selected === id) setSelected(null);
      await load();
    } finally {
      setRemoving(null);
    }
  }

  async function handleMerge(id: string) {
    setMerging(id);
    try {
      await mergeWorktree(id, "main");
      await load();
    } finally {
      setMerging(null);
    }
  }

  async function handleSelect(id: string) {
    if (selected === id) {
      setSelected(null);
      return;
    }
    setSelected(id);
    const status = await getWorktreeStatus(id);
    setSelectedStatus(status);
  }

  const activeWorktrees = worktrees.filter((w) => w.status === "active");
  const mergedWorktrees = worktrees.filter((w) => w.status === "merged");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[600px] mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text">🌳 Git Worktrees</span>
            <span className="text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded">
              {activeWorktrees.length} aktivnih
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="text-[11px] text-accent hover:text-accent-light px-2 py-1 rounded hover:bg-surface-2 transition-colors"
            >
              + Novi worktree
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {loading && (
            <div className="text-center py-8 text-text-muted text-[11px]">
              Učitavam worktree-ove...
            </div>
          )}

          {!loading && worktrees.length === 0 && (
            <div className="text-center py-8">
              <div className="text-text-muted text-[11px] mb-2">
                Nema worktree-ova
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="text-[11px] text-accent hover:text-accent-light"
              >
                + Kreiraj prvi worktree
              </button>
            </div>
          )}

          {/* Active worktrees */}
          {activeWorktrees.length > 0 && (
            <div>
              <div className="text-[9px] text-text-muted uppercase tracking-wider font-medium mb-1.5 px-1">
                Aktivni
              </div>
              <div className="space-y-1">
                {activeWorktrees.map((wt) => (
                  <WorktreeCard
                    key={wt.id}
                    worktree={wt}
                    selected={selected === wt.id}
                    status={selected === wt.id ? selectedStatus : []}
                    onSelect={() => handleSelect(wt.id)}
                    onMerge={() => handleMerge(wt.id)}
                    onRemove={() => handleRemove(wt.id)}
                    merging={merging === wt.id}
                    removing={removing === wt.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Merged worktrees */}
          {mergedWorktrees.length > 0 && (
            <div>
              <div className="text-[9px] text-text-muted uppercase tracking-wider font-medium mb-1.5 px-1">
                Merge-ani
              </div>
              <div className="space-y-1">
                {mergedWorktrees.map((wt) => (
                  <WorktreeCard
                    key={wt.id}
                    worktree={wt}
                    selected={selected === wt.id}
                    status={selected === wt.id ? selectedStatus : []}
                    onSelect={() => handleSelect(wt.id)}
                    onMerge={() => {}}
                    onRemove={() => handleRemove(wt.id)}
                    merging={false}
                    removing={removing === wt.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border shrink-0">
          <span className="text-[9px] text-text-muted">
            Isolacija: svaki agent radi u svom worktree-u
          </span>
          <button
            onClick={onClose}
            className="text-[11px] text-text-muted hover:text-text px-3 py-1 rounded-lg hover:bg-surface-2 transition-colors"
          >
            Zatvori
          </button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-[400px] mx-4 bg-surface border border-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-[12px] font-semibold text-text">Novi worktree</span>
              <button
                onClick={() => setShowCreate(false)}
                className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[9px] text-text-muted uppercase tracking-wider font-medium mb-0.5 block">
                  Ime grane
                </label>
                <input
                  type="text"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  placeholder="npr. feature-login"
                  className="w-full bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-[9px] text-text-muted uppercase tracking-wider font-medium mb-0.5 block">
                  Iz grane
                </label>
                <input
                  type="text"
                  value={fromBranch}
                  onChange={(e) => setFromBranch(e.target.value)}
                  placeholder="main"
                  className="w-full bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-[9px] text-text-muted uppercase tracking-wider font-medium mb-0.5 block">
                  Naziv zadatka (opc.)
                </label>
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="npr. Implementacija login forme"
                  className="w-full bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
              <button
                onClick={() => setShowCreate(false)}
                className="text-[11px] text-text-muted hover:text-text px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors"
              >
                Otkaži
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newBranch.trim()}
                className="text-[11px] text-white bg-accent hover:bg-accent-light px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
              >
                {creating ? "Kreiram..." : "Kreiraj"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorktreeCard({
  worktree: wt,
  selected,
  status,
  onSelect,
  onMerge,
  onRemove,
  merging,
  removing,
}: {
  worktree: Worktree;
  selected: boolean;
  status: GitStatus[];
  onSelect: () => void;
  onMerge: () => void;
  onRemove: () => void;
  merging: boolean;
  removing: boolean;
}) {
  return (
    <div
      className={`rounded-lg border transition-colors ${
        selected
          ? "border-accent/40 bg-accent/5"
          : "border-border bg-surface-2/50 hover:border-border-light"
      }`}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={onSelect}
      >
        <span className="text-sm">🌳</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-text font-mono">
              {wt.branch}
            </span>
            <span className={`text-[8px] px-1.5 py-0.5 rounded border ${STATUS_BG[wt.status]} ${STATUS_COLORS[wt.status]}`}>
              {wt.status}
            </span>
          </div>
          {wt.taskName && (
            <div className="text-[9px] text-text-muted mt-0.5 truncate">
              {wt.taskName}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {wt.status === "active" && (
            <button
              onClick={(e) => { e.stopPropagation(); onMerge(); }}
              disabled={merging}
              className="text-[9px] text-accent-blue hover:text-accent-blue/80 px-1.5 py-0.5 rounded hover:bg-accent-blue/10 disabled:opacity-40"
            >
              {merging ? "⟳" : "↘ Merge"}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            disabled={removing}
            className="text-[9px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-500/10 disabled:opacity-40"
          >
            {removing ? "⟳" : "✕"}
          </button>
          <span className="text-[10px] text-text-muted">
            {selected ? "▾" : "▸"}
          </span>
        </div>
      </div>

      {/* Status detail */}
      {selected && status.length > 0 && (
        <div className="px-3 pb-2 border-t border-border pt-1.5">
          <div className="text-[9px] text-text-muted uppercase tracking-wider font-medium mb-1">
            Promjene ({status.length})
          </div>
          <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
            {status.map((s) => (
              <div key={s.path} className="flex items-center gap-1.5 text-[10px]">
                <span className={`w-4 text-center ${
                  s.status === "modified" ? "text-yellow-400"
                    : s.status === "added" ? "text-green-400"
                    : s.status === "deleted" ? "text-red-400"
                    : "text-text-muted"
                }`}>
                  {s.status === "modified" ? "M"
                    : s.status === "added" ? "A"
                    : s.status === "deleted" ? "D"
                    : "?"}
                </span>
                <span className="text-text-secondary font-mono truncate">
                  {s.path}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && status.length === 0 && (
        <div className="px-3 pb-2 border-t border-border pt-1.5 text-[10px] text-text-muted">
          Čist worktree — nema promjena
        </div>
      )}
    </div>
  );
}
