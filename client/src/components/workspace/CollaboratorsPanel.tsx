import { useState, useEffect, useCallback } from "react";
import {
  listCollaborators,
  addCollaborator,
  updateCollaboratorRole,
  removeCollaborator,
  type ProjectCollaborator,
} from "../../lib/teams";

interface Props {
  projectId: string;
  isOwner: boolean;
  onClose: () => void;
}

const ROLES = ["admin", "member", "viewer"];

export default function CollaboratorsPanel({ projectId, isOwner, onClose }: Props) {
  const [collabs, setCollabs] = useState<ProjectCollaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [actionMsg, setActionMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const c = await listCollaborators(projectId);
      setCollabs(c);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 2500);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await addCollaborator(projectId, inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      flash("Dodato");
      load();
    } catch (err: any) {
      flash(err.message);
    }
  };

  const handleRoleChange = async (collabId: string, role: string) => {
    try {
      await updateCollaboratorRole(projectId, collabId, role);
      flash("Uloga promijenjena");
      load();
    } catch (err: any) {
      flash(err.message);
    }
  };

  const handleRemove = async (collabId: string) => {
    try {
      await removeCollaborator(projectId, collabId);
      flash("Uklonjeno");
      load();
    } catch (err: any) {
      flash(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-[13px] font-semibold text-text">👥 Saradnici projekta</span>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">✕</button>
        </div>

        <div className="p-4 max-h-[50vh] overflow-y-auto space-y-3">
          {actionMsg && (
            <div className="text-[10px] text-accent bg-accent/10 px-3 py-1.5 rounded-lg">{actionMsg}</div>
          )}

          {isOwner && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text focus:outline-none"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={handleInvite} disabled={!inviteEmail.trim()} className="text-[11px] text-white bg-accent hover:bg-accent-light disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors">
                Dodaj
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-[11px] text-text-muted text-center py-4">Učitavanje...</div>
          ) : error ? (
            <div className="text-[11px] text-red-400 text-center py-4">{error}</div>
          ) : collabs.length === 0 ? (
            <div className="text-[11px] text-text-muted text-center py-4">Nema saradnika</div>
          ) : (
            collabs.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent">
                    {c.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[11px] text-text">{c.email}</div>
                    {isOwner ? (
                      <select
                        value={c.role}
                        onChange={(e) => handleRoleChange(c.id, e.target.value)}
                        className="text-[9px] bg-transparent text-text-muted border-none focus:outline-none cursor-pointer"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span className="text-[9px] text-text-muted">{c.role}</span>
                    )}
                  </div>
                </div>
                {isOwner && (
                  <button onClick={() => handleRemove(c.id)} className="text-[9px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-500/10">
                    Ukloni
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
