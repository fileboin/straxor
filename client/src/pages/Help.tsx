import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.js";
import { useTheme } from "../lib/theme.js";
import {
  getMyTickets, createTicket, getTicket, sendTicketMessage,
  submitFeedback, getFeatureRequests, createFeatureRequest, toggleVote,
} from "../lib/support.js";

type HelpTab = "tickets" | "new-ticket" | "ticket-detail" | "feedback" | "feature-requests";

export default function Help() {
  const { user, logout } = useAuth();
  const { toggleTheme, theme } = useTheme();
  const navigate = useNavigate();

  const [tab, setTab] = useState<HelpTab>("tickets");
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const flash = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(""), 2500); };

  // Tickets
  const [tickets, setTickets] = useState<any[]>([]);
  const [newTicket, setNewTicket] = useState({ subject: "", description: "", category: "general", priority: "normal", logData: "" });
  const [ticketMsg, setTicketMsg] = useState("");

  // Feedback
  const [feedbackForm, setFeedbackForm] = useState({ type: "feedback", subject: "", description: "", logData: "" });

  // Feature Requests
  const [features, setFeatures] = useState<any[]>([]);
  const [featureForm, setFeatureForm] = useState({ title: "", description: "", category: "general" });
  const [showFeatureForm, setShowFeatureForm] = useState(false);

  const loadTickets = useCallback(async () => { try { setTickets(await getMyTickets()); } catch { flash("Error"); } }, []);
  const loadFeatures = useCallback(async () => { try { setFeatures(await getFeatureRequests()); } catch { flash("Error"); } }, []);

  useEffect(() => {
    if (tab === "tickets" || tab === "new-ticket") loadTickets();
    if (tab === "feature-requests") loadFeatures();
  }, [tab, loadTickets, loadFeatures]);

  const handleCreateTicket = async () => {
    if (!newTicket.subject || !newTicket.description) { flash("Subject and description required"); return; }
    try { await createTicket(newTicket); flash("Ticket created"); setNewTicket({ subject: "", description: "", category: "general", priority: "normal", logData: "" }); setTab("tickets"); loadTickets(); }
    catch { flash("Error"); }
  };

  const handleOpenTicket = async (id: string) => {
    try { const t = await getTicket(id); setActiveTicket(t); setTab("ticket-detail"); } catch { flash("Error"); }
  };

  const handleSendMessage = async () => {
    if (!ticketMsg || !activeTicket) return;
    try { await sendTicketMessage(activeTicket.id, ticketMsg); setTicketMsg(""); const t = await getTicket(activeTicket.id); setActiveTicket(t); } catch { flash("Error"); }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackForm.subject) { flash("Subject required"); return; }
    try { await submitFeedback(feedbackForm); flash("Feedback submitted"); setFeedbackForm({ type: "feedback", subject: "", description: "", logData: "" }); } catch { flash("Error"); }
  };

  const handleCreateFeature = async () => {
    if (!featureForm.title) { flash("Title required"); return; }
    try { await createFeatureRequest(featureForm); flash("Feature request created"); setShowFeatureForm(false); setFeatureForm({ title: "", description: "", category: "general" }); loadFeatures(); }
    catch { flash("Error"); }
  };

  const handleVote = async (id: string) => {
    try { await toggleVote(id); loadFeatures(); } catch { flash("Error"); }
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = { open: "#3b82f6", in_progress: "#f59e0b", resolved: "#22c55e", closed: "#6b7280", new: "#8b5cf6", reviewing: "#f59e0b", planned: "#3b82f6", in_development: "#f97316", completed: "#22c55e", rejected: "#ef4444" };
    return map[s] || "#6b7280";
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-bold text-text">Help & Support</h1>
        </div>
        <div className="flex items-center gap-2">
          {actionMsg && <span className="text-[11px] text-accent animate-pulse hidden sm:inline">{actionMsg}</span>}
          <button onClick={() => navigate("/")} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text">← Dashboard</button>
          <button onClick={toggleTheme} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-text hover:bg-surface-2">{theme === "dark" ? "☀" : "☾"}</button>
          <span className="text-[11px] text-text-muted hidden sm:inline">{user?.email}</span>
          <button onClick={logout} className="text-[11px] text-text-muted hover:text-text">Logout</button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-48 shrink-0 border-r border-border bg-surface-2/50 overflow-y-auto">
          <nav className="p-2 space-y-0.5">
            {([
              ["tickets", "🎫", "My Tickets"],
              ["new-ticket", "➕", "New Ticket"],
              ["feedback", "💬", "Send Feedback"],
              ["feature-requests", "💡", "Feature Requests"],
            ] as const).map(([id, icon, label]) => (
              <button key={id} onClick={() => { setTab(id as HelpTab); if (id === "ticket-detail") setActiveTicket(null); }} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors text-left ${tab === id ? "bg-accent/15 text-accent border border-accent/20" : "text-text-secondary hover:text-text hover:bg-surface-2 border border-transparent"}`}>
                <span>{icon}</span><span>{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* My Tickets */}
          {tab === "tickets" && (
            <div className="space-y-3">
              <h2 className="text-[16px] font-bold text-text mb-4">My Support Tickets</h2>
              {tickets.length === 0 && <div className="text-[12px] text-text-muted px-4 py-8 text-center">No tickets yet.</div>}
              <div className="space-y-1.5">
                {tickets.map((t) => (
                  <div key={t.id} onClick={() => handleOpenTicket(t.id)} className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-2 border border-border cursor-pointer hover:bg-surface-3 transition-colors">
                    <div className="flex-1 min-w-0"><div className="text-[13px] font-medium text-text truncate">{t.subject}</div><div className="text-[10px] text-text-muted mt-0.5">{t.category} · {new Date(t.createdAt).toLocaleDateString()}</div></div>
                    <div className="flex items-center gap-2 shrink-0"><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${statusColor(t.status)}20`, color: statusColor(t.status) }}>{t.status}</span><span className={`text-[10px] px-2 py-0.5 rounded-full ${t.priority === "high" ? "bg-red-500/20 text-red-400" : t.priority === "urgent" ? "bg-orange-500/20 text-orange-400" : "bg-surface-3 text-text-muted"}`}>{t.priority}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Ticket */}
          {tab === "new-ticket" && (
            <div className="max-w-lg space-y-4">
              <h2 className="text-[16px] font-bold text-text">Create Support Ticket</h2>
              <div><label className="text-[11px] text-text-muted block mb-1">Subject</label><input type="text" value={newTicket.subject} onChange={(e) => setNewTicket((p) => ({ ...p, subject: e.target.value }))} className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
              <div><label className="text-[11px] text-text-muted block mb-1">Description</label><textarea value={newTicket.description} onChange={(e) => setNewTicket((p) => ({ ...p, description: e.target.value }))} rows={4} className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] text-text-muted block mb-1">Category</label><select value={newTicket.category} onChange={(e) => setNewTicket((p) => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none"><option value="general">General</option><option value="bug">Bug</option><option value="account">Account</option><option value="billing">Billing</option><option value="technical">Technical</option></select></div><div><label className="text-[11px] text-text-muted block mb-1">Priority</label><select value={newTicket.priority} onChange={(e) => setNewTicket((p) => ({ ...p, priority: e.target.value }))} className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div></div>
              <div><label className="text-[11px] text-text-muted block mb-1">Error Log (optional)</label><textarea value={newTicket.logData} onChange={(e) => setNewTicket((p) => ({ ...p, logData: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[11px] text-text outline-none focus:border-accent font-mono" /></div>
              <button onClick={handleCreateTicket} className="px-4 py-2 rounded-lg bg-accent text-white text-[12px] hover:bg-accent-light">Submit Ticket</button>
            </div>
          )}

          {/* Ticket Detail */}
          {tab === "ticket-detail" && activeTicket && (
            <div className="max-w-2xl space-y-4">
              <button onClick={() => { setTab("tickets"); setActiveTicket(null); }} className="text-[11px] text-text-muted hover:text-text">← Back to tickets</button>
              <div className="flex items-center justify-between"><h2 className="text-[16px] font-bold text-text">{activeTicket.subject}</h2><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${statusColor(activeTicket.status)}20`, color: statusColor(activeTicket.status) }}>{activeTicket.status}</span></div>
              <div className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[11px] text-text-muted mb-2">{activeTicket.category} · {activeTicket.priority} · {new Date(activeTicket.createdAt).toLocaleString()}</div><div className="text-[12px] text-text whitespace-pre-wrap">{activeTicket.description}</div></div>
              {/* Messages */}
              <div className="space-y-2">
                <h4 className="text-[12px] font-semibold text-text">Conversation</h4>
                {activeTicket.messages?.map((m: any) => (
                  <div key={m.id} className={`p-3 rounded-xl ${m.isAdmin ? "bg-accent/10 border border-accent/20 ml-8" : "bg-surface-2 border border-border mr-8"}`}>
                    <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-medium text-text-muted">{m.isAdmin ? "Support" : "You"}</span><span className="text-[9px] text-text-muted">{new Date(m.createdAt).toLocaleString()}</span></div>
                    <div className="text-[12px] text-text">{m.message}</div>
                  </div>
                ))}
              </div>
              {/* Reply */}
              <div className="flex items-center gap-2"><input type="text" value={ticketMsg} onChange={(e) => setTicketMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendMessage()} placeholder="Type a message..." className="flex-1 px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /><button onClick={handleSendMessage} className="px-3 py-2 rounded-lg bg-accent text-white text-[11px] hover:bg-accent-light">Send</button></div>
            </div>
          )}

          {/* Send Feedback */}
          {tab === "feedback" && (
            <div className="max-w-lg space-y-4">
              <h2 className="text-[16px] font-bold text-text">Send Feedback</h2>
              <div><label className="text-[11px] text-text-muted block mb-1">Type</label><select value={feedbackForm.type} onChange={(e) => setFeedbackForm((p) => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none"><option value="feedback">Feedback</option><option value="bug">Bug Report</option><option value="feature">Feature Request</option><option value="complaint">Complaint</option></select></div>
              <div><label className="text-[11px] text-text-muted block mb-1">Subject</label><input type="text" value={feedbackForm.subject} onChange={(e) => setFeedbackForm((p) => ({ ...p, subject: e.target.value }))} className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
              <div><label className="text-[11px] text-text-muted block mb-1">Description</label><textarea value={feedbackForm.description} onChange={(e) => setFeedbackForm((p) => ({ ...p, description: e.target.value }))} rows={4} className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
              <div><label className="text-[11px] text-text-muted block mb-1">Error Log (optional)</label><textarea value={feedbackForm.logData} onChange={(e) => setFeedbackForm((p) => ({ ...p, logData: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[11px] text-text outline-none focus:border-accent font-mono" /></div>
              <button onClick={handleSubmitFeedback} className="px-4 py-2 rounded-lg bg-accent text-white text-[12px] hover:bg-accent-light">Submit Feedback</button>
            </div>
          )}

          {/* Feature Requests */}
          {tab === "feature-requests" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-bold text-text">Feature Requests</h2><button onClick={() => setShowFeatureForm(true)} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">+ Suggest Idea</button></div>
              <div className="space-y-1.5">
                {features.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-2 border border-border">
                    <button onClick={() => handleVote(f.id)} className="flex flex-col items-center w-10 shrink-0"><span className="text-[11px] font-bold text-accent">{f.voteCount}</span><span className="text-[9px] text-text-muted">votes</span></button>
                    <div className="flex-1 min-w-0"><div className="text-[13px] font-medium text-text">{f.title}</div><div className="text-[10px] text-text-muted mt-0.5 truncate">{f.description || f.category}</div></div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: `${statusColor(f.status)}20`, color: statusColor(f.status) }}>{f.status}</span>
                  </div>
                ))}
              </div>
              {showFeatureForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="w-full max-w-md mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4">
                    <h4 className="text-[13px] font-bold">Suggest a Feature</h4>
                    <div><label className="text-[11px] text-text-muted block mb-1">Title</label><input type="text" value={featureForm.title} onChange={(e) => setFeatureForm((p) => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
                    <div><label className="text-[11px] text-text-muted block mb-1">Description</label><textarea value={featureForm.description} onChange={(e) => setFeatureForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
                    <div><label className="text-[11px] text-text-muted block mb-1">Category</label><select value={featureForm.category} onChange={(e) => setFeatureForm((p) => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none"><option value="general">General</option><option value="editor">Editor</option><option value="agents">Agents</option><option value="deploy">Deploy</option><option value="ai">AI</option><option value="integrations">Integrations</option></select></div>
                    <div className="flex items-center justify-end gap-2 pt-2"><button onClick={() => setShowFeatureForm(false)} className="text-[11px] px-3 py-1.5 text-text-muted hover:text-text">Cancel</button><button onClick={handleCreateFeature} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Submit</button></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
