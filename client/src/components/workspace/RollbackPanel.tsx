import { useState, useEffect, useCallback } from "react";
import {
  createSnapshot, listSnapshots, restoreSnapshot, deleteSnapshot,
  diffSnapshot, RESTORE_TYPE_LABELS, RESTORE_TYPE_ICONS,
  type RestorePoint, type RestorePointType, type SnapshotDiff,
} from "../../lib/rollback";

interface Props {
  machineId: string | null;
  projectPath: string;
  onClose: () => void;
}

export default function RollbackPanel({ machineId, projectPath, onClose }: Props) {
  const [snapshots, setSnapshots] = useState<RestorePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createType, setCreateType] = useState<RestorePointType>("manual");

  // Restore confirmation
  const [confirmRestore, setConfirmRestore] = useState<RestorePoint | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Diff view
  const [diffTarget, setDiffTarget] = useState<RestorePoint | null>(null);
  const [diffResult, setDiffResult] = useState<SnapshotDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<RestorePoint | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load snapshots ──
  const loadSnapshots = useCallback(async () => {
    if (!machineId) return;
    setLoading(true);
    try {
      const list = await listSnapshots(machineId, projectPath);
      setSnapshots(list);
    } catch { /* ok */ }
    setLoading(false);
  }, [machineId, projectPath]);

  useEffect(() => { loadSnapshots(); }, [loadSnapshots]);

  // ── Create snapshot ──
  const handleCreate = useCallback(async () => {
    if (!machineId || !createName.trim()) return;
    setCreating(true);
    try {
      const snap = await createSnapshot(machineId, projectPath, createName.trim(), createDesc.trim(), createType);
      setSnapshots((prev) => [snap, ...prev]);
      setShowCreate(false);
      setCreateName("");
      setCreateDesc("");
      setCreateType("manual");
    } catch { /* ok */ }
    setCreating(false);
  }, [machineId, projectPath, createName, createDesc, createType]);

  // ── Restore snapshot ──
  const handleRestore = useCallback(async () => {
    if (!machineId || !confirmRestore) return;
    setRestoring(true);
    try {
      await restoreSnapshot(machineId, projectPath, confirmRestore.snapshotPath);
      setConfirmRestore(null);
    } catch { /* ok */ }
    setRestoring(false);
  }, [machineId, projectPath, confirmRestore]);

  // ── Diff snapshot ──
  const handleDiff = useCallback(async (snap: RestorePoint) => {
    if (!machineId) return;
    setDiffTarget(snap);
    setDiffLoading(true);
    try {
      const diff = await diffSnapshot(machineId, projectPath, snap.snapshotPath);
      setDiffResult(diff);
    } catch { /* ok */ }
    setDiffLoading(false);
  }, [machineId, projectPath]);

  // ── Delete snapshot ──
  const handleDelete = useCallback(async () => {
    if (!machineId || !confirmDelete) return;
    setDeleting(true);
    try {
      await deleteSnapshot(machineId, confirmDelete.id, confirmDelete.snapshotPath);
      setSnapshots((prev) => prev.filter((s) => s.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch { /* ok */ }
    setDeleting(false);
  }, [machineId, confirmDelete]);

  // ── Group by date ──
  const grouped = snapshots.reduce<Record<string, RestorePoint[]>>((acc, snap) => {
    const date = new Date(snap.createdAt).toLocaleDateString("hr-HR", { day: "numeric", month: "long", year: "numeric" });
    if (!acc[date]) acc[date] = [];
    acc[date].push(snap);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[600px] mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text">Historija verzija</span>
            <span className="text-[9px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded">
              {snapshots.length} točaka
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowCreate(true)}
              className="px-2.5 py-1 text-[10px] font-medium bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors"
            >
              + Kreiraj točku
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {!machineId && (
            <div className="text-center py-12 text-text-muted text-[11px]">
              Poveži GitHub repo ili VPS za korištenje historije verzija
            </div>
          )}

          {machineId && loading && (
            <div className="text-center py-12 text-text-muted text-[11px]">Učitavam…</div>
          )}

          {machineId && !loading && snapshots.length === 0 && (
            <div className="text-center py-12 text-text-muted text-[11px]">
              <div className="text-2xl mb-2 opacity-30">📌</div>
              <div>Nema točaka oporavka</div>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-2 text-accent text-[10px] hover:underline"
              >
                Kreiraj prvu točku
              </button>
            </div>
          )}

          {/* Timeline */}
          {Object.entries(grouped).map(([date, snaps]) => (
            <div key={date} className="mb-4">
              <div className="text-[9px] text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent/30" />
                {date}
              </div>
              <div className="space-y-1.5 ml-1 border-l border-[#2d3750] pl-3">
                {snaps.map((snap) => (
                  <div
                    key={snap.id}
                    className="group relative bg-[#141824] rounded-lg border border-[#2d3750] p-2.5 hover:border-accent/30 transition-colors"
                  >
                    {/* Dot on timeline */}
                    <div className="absolute -left-[17px] top-3 w-2.5 h-2.5 rounded-full bg-surface border-2 border-accent/40" />

                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px]">{RESTORE_TYPE_ICONS[snap.type]}</span>
                          <span className="text-[11px] font-medium text-text truncate">{snap.name}</span>
                          <span className="text-[8px] text-text-muted bg-surface-2 px-1 py-0.5 rounded">
                            {RESTORE_TYPE_LABELS[snap.type]}
                          </span>
                        </div>
                        {snap.description && (
                          <div className="text-[10px] text-text-muted mt-0.5 truncate">{snap.description}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-[9px] text-text-muted/50">
                          <span>{snap.fileCount} datoteka</span>
                          <span>{snap.totalSize}</span>
                          {snap.gitCommit && (
                            <span className="font-mono">{snap.gitCommit.slice(0, 7)}</span>
                          )}
                          <span>{new Date(snap.createdAt).toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => handleDiff(snap)}
                          className="px-1.5 py-0.5 text-[9px] text-text-muted hover:text-accent rounded hover:bg-accent/10 transition-colors"
                          title="Usporedi s trenutnim stanjem"
                        >
                          Diff
                        </button>
                        <button
                          onClick={() => setConfirmRestore(snap)}
                          className="px-1.5 py-0.5 text-[9px] text-text-muted hover:text-accent rounded hover:bg-accent/10 transition-colors"
                          title="Vrati na ovo stanje"
                        >
                          ↺
                        </button>
                        <button
                          onClick={() => setConfirmDelete(snap)}
                          className="px-1.5 py-0.5 text-[9px] text-text-muted hover:text-red-400 rounded hover:bg-red-400/10 transition-colors"
                          title="Obriši snapshot"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Create Dialog ── */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-sm mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-[12px] font-semibold text-text">Nova točka oporavka</div>
            <label className="space-y-0.5">
              <span className="text-[9px] text-text-muted">Naziv</span>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="npr. Prije refaktoriranja"
                className="w-full px-2 py-1.5 bg-[#0e1422] text-text text-[11px] rounded border border-[#202838] focus:border-accent outline-none"
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-[9px] text-text-muted">Opis (opcionalno)</span>
              <input
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Kratki opis promjena…"
                className="w-full px-2 py-1.5 bg-[#0e1422] text-text text-[11px] rounded border border-[#202838] focus:border-accent outline-none"
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-[9px] text-text-muted">Tip</span>
              <div className="flex gap-1 flex-wrap">
                {(["version", "task", "diff", "build", "manual"] as RestorePointType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setCreateType(t)}
                    className={`px-2 py-1 text-[9px] rounded-lg border transition-colors ${
                      createType === t
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-[#202838] text-text-muted hover:border-[#2d3750]"
                    }`}
                  >
                    {RESTORE_TYPE_ICONS[t]} {RESTORE_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-[10px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 transition-colors">
                Odustani
              </button>
              <button
                onClick={handleCreate}
                disabled={!createName.trim() || creating}
                className="px-3 py-1.5 text-[10px] font-medium bg-accent text-white rounded-lg hover:bg-accent-light disabled:opacity-30 transition-colors"
              >
                {creating ? "Kreiram…" : "Kreiraj"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Diff Dialog ── */}
      {diffTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => { setDiffTarget(null); setDiffResult(null); }}>
          <div className="w-full max-w-lg mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-4 space-y-3 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="text-[12px] font-semibold text-text flex items-center gap-2">
              <span>🔀</span>
              <span>Diff: {diffTarget.name}</span>
            </div>
            {diffLoading && <div className="text-[11px] text-text-muted py-4 text-center">Uspoređujem…</div>}
            {diffResult && (
              <div className="space-y-2">
                <div className="text-[10px] text-text-muted">
                  {diffResult.totalChanges === 0 ? (
                    <span className="text-accent">Nema promjena — trenutno stanje je identično</span>
                  ) : (
                    <span>{diffResult.totalChanges} promjena</span>
                  )}
                </div>
                {diffResult.filesAdded.length > 0 && (
                  <div className="bg-[#141824] rounded-lg border border-[#2d3750] p-2">
                    <div className="text-[9px] text-green-400 font-medium mb-1">+ {diffResult.filesAdded.length} novih datoteka</div>
                    {diffResult.filesAdded.slice(0, 20).map((f) => (
                      <div key={f} className="text-[9px] text-green-400/80 font-mono truncate">+ {f}</div>
                    ))}
                    {diffResult.filesAdded.length > 20 && (
                      <div className="text-[8px] text-text-muted/40 mt-0.5">… i još {diffResult.filesAdded.length - 20}</div>
                    )}
                  </div>
                )}
                {diffResult.filesRemoved.length > 0 && (
                  <div className="bg-[#141824] rounded-lg border border-[#2d3750] p-2">
                    <div className="text-[9px] text-red-400 font-medium mb-1">- {diffResult.filesRemoved.length} uklonjenih datoteka</div>
                    {diffResult.filesRemoved.slice(0, 20).map((f) => (
                      <div key={f} className="text-[9px] text-red-400/80 font-mono truncate">- {f}</div>
                    ))}
                  </div>
                )}
                {diffResult.filesModified.length > 0 && (
                  <div className="bg-[#141824] rounded-lg border border-[#2d3750] p-2">
                    <div className="text-[9px] text-yellow-400 font-medium mb-1">~ {diffResult.filesModified.length} modificiranih datoteka</div>
                    {diffResult.filesModified.slice(0, 20).map((f) => (
                      <div key={f} className="text-[9px] text-yellow-400/80 font-mono truncate">~ {f}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end pt-1">
              <button onClick={() => { setDiffTarget(null); setDiffResult(null); }} className="px-3 py-1.5 text-[10px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 transition-colors">
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Restore Confirmation ── */}
      {confirmRestore && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setConfirmRestore(null)}>
          <div className="w-full max-w-sm mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-[12px] font-semibold text-text">↺ Vrati na točku oporavka?</div>
            <div className="text-[11px] text-text-secondary">
              Vratit ćeš cijeli projekt na stanje:
            </div>
            <div className="bg-[#141824] rounded-lg border border-[#2d3750] p-2.5 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span>{RESTORE_TYPE_ICONS[confirmRestore.type]}</span>
                <span className="font-medium text-text">{confirmRestore.name}</span>
              </div>
              <div className="text-text-muted mt-0.5">{confirmRestore.fileCount} datoteka &middot; {confirmRestore.totalSize}</div>
              <div className="text-text-muted/50 text-[9px] mt-0.5">{new Date(confirmRestore.createdAt).toLocaleString("hr-HR")}</div>
            </div>
            <div className="text-[10px] text-yellow-400/80 bg-yellow-400/5 border border-yellow-400/20 rounded-lg px-2.5 py-1.5">
              ⚠ Trenutne promjene će biti prepisane. Napravi snapshot ako želiš sačuvati trenutno stanje.
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConfirmRestore(null)} className="px-3 py-1.5 text-[10px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 transition-colors">
                Odustani
              </button>
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="px-3 py-1.5 text-[10px] font-medium bg-accent text-white rounded-lg hover:bg-accent-light disabled:opacity-30 transition-colors"
              >
                {restoring ? "Vraćam…" : "Vrati"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-[12px] font-semibold text-text">Obriši točku oporavka?</div>
            <div className="text-[11px] text-text-secondary">
              Ova radnja se ne može poništiti.
            </div>
            <div className="bg-[#141824] rounded-lg border border-[#2d3750] p-2 text-[10px] font-medium text-text">
              {confirmDelete.name}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 text-[10px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 transition-colors">
                Odustani
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-[10px] font-medium bg-red-500/80 text-white rounded-lg hover:bg-red-500 disabled:opacity-30 transition-colors"
              >
                {deleting ? "Brišem…" : "Obriši"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
