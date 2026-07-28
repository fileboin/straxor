import { useState, useEffect, useCallback } from "react";
import {
  listTeams,
  createTeam,
  getTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  type Team,
  type TeamDetail,
} from "../../lib/teams";

interface Props {
  onClose: () => void;
}

const ROLES = ["admin", "member", "viewer"];

export default function TeamPanel({ onClose }: Props) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const t = await listTeams();
      setTeams(t);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 2500);
  };

  const selectTeam = async (id: string) => {
    try {
      const detail = await getTeam(id);
      setSelectedTeam(detail);
    } catch (err: any) {
      flash(err.message);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const team = await createTeam(newName.trim());
      setTeams((prev) => [...prev, team]);
      setNewName("");
      setShowCreate(false);
      flash("Tim kreiran");
    } catch (err: any) {
      flash(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTeam(id);
      setTeams((prev) => prev.filter((t) => t.id !== id));
      setSelectedTeam(null);
      flash("Obrisano");
    } catch (err: any) {
      flash(err.message);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !selectedTeam) return;
    try {
      await addTeamMember(selectedTeam.id, inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      flash("Poziv poslan");
      selectTeam(selectedTeam.id);
    } catch (err: any) {
      flash(err.message);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam) return;
    try {
      await removeTeamMember(selectedTeam.id, memberId);
      flash("Član uklonjen");
      selectTeam(selectedTeam.id);
    } catch (err: any) {
      flash(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <span className="text-lg">👥</span>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-text">Team Collaboration</h1>
              <p className="text-[10px] text-text-muted">{teams.length} timova</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {actionMsg && (
              <span className="text-[10px] text-accent px-2 py-1 rounded bg-accent/10">{actionMsg}</span>
            )}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1 text-[11px] text-white bg-accent hover:bg-accent-light px-3 py-1.5 rounded-lg transition-colors"
            >
              + Novi tim
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Team list */}
          <div className="w-56 border-r border-border overflow-y-auto shrink-0">
            {loading ? (
              <div className="text-[11px] text-text-muted text-center py-8">Učitavanje...</div>
            ) : error ? (
              <div className="text-[11px] text-red-400 text-center py-8">{error}</div>
            ) : teams.length === 0 ? (
              <div className="text-[11px] text-text-muted text-center py-8">
                <span className="text-2xl block mb-2">👥</span>
                Nema timova
              </div>
            ) : (
              teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => selectTeam(team.id)}
                  className={`w-full text-left px-4 py-2.5 border-b border-border/50 transition-colors ${
                    selectedTeam?.id === team.id
                      ? "bg-accent/10 border-l-2 border-l-accent"
                      : "hover:bg-surface-2 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="text-[12px] font-medium text-text">{team.name}</div>
                  <div className="text-[9px] text-text-muted">{timeAgo(team.createdAt)}</div>
                </button>
              ))
            )}
          </div>

          {/* Team detail */}
          <div className="flex-1 overflow-y-auto p-5">
            {!selectedTeam ? (
              <div className="flex flex-col items-center justify-center h-full text-[11px] text-text-muted">
                <span className="text-3xl mb-2">👥</span>
                Izaberi tim za upravljanje
              </div>
            ) : (
              <div className="space-y-4">
                {/* Team info */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[14px] font-bold text-text">{selectedTeam.name}</h2>
                    <p className="text-[10px] text-text-muted">{selectedTeam.members.length} članova</p>
                  </div>
                  {selectedTeam.isOwner && (
                    <button
                      onClick={() => handleDelete(selectedTeam.id)}
                      className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10"
                    >
                      Obriši tim
                    </button>
                  )}
                </div>

                {/* Invite form */}
                {selectedTeam.isOwner && (
                  <div className="flex items-center gap-2 bg-surface-2/50 border border-border/50 rounded-xl p-3">
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
                    <button
                      onClick={handleInvite}
                      disabled={!inviteEmail.trim()}
                      className="text-[11px] text-white bg-accent hover:bg-accent-light disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Pozovi
                    </button>
                  </div>
                )}

                {/* Members */}
                <div>
                  <h3 className="text-[11px] font-semibold text-text mb-2">Članovi</h3>
                  <div className="space-y-1">
                    {selectedTeam.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[9px] font-bold text-accent">
                            {member.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-[11px] text-text">{member.email}</div>
                            <div className="text-[9px] text-text-muted">
                              {member.role} · {timeAgo(member.joinedAt)}
                            </div>
                          </div>
                        </div>
                        {selectedTeam.isOwner && member.userId !== selectedTeam.ownerId && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-[9px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-500/10"
                          >
                            Ukloni
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-sm mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[13px] font-semibold text-text mb-3">Novi tim</h2>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ime tima"
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-[12px] text-text focus:outline-none focus:border-accent/50 mb-3"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="text-[11px] text-text-muted hover:text-text px-3 py-1.5 rounded-lg hover:bg-surface-2">
                Otkaži
              </button>
              <button onClick={handleCreate} disabled={!newName.trim()} className="text-[11px] text-white bg-accent hover:bg-accent-light disabled:opacity-40 px-4 py-1.5 rounded-lg transition-colors">
                Kreiraj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "upravo";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
