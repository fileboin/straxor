import { useState, useEffect, useCallback } from "react";
import {
  listRules, createRule, updateRule, deleteRule,
  listMemories, createMemory, deleteMemory,
  searchWeb, fetchUrl, saveWebResearch,
  assembleContext,
  RULE_CATEGORIES, MEMORY_CATEGORIES, SOURCE_ICONS,
  type ProjectRule, type Memory, type RuleCategory, type MemoryCategory,
  type AssembledContext,
} from "../../lib/context.js";

interface Props {
  projectId: string;
  machineId?: string | null;
  projectPath?: string;
  onClose: () => void;
  onAssembled?: (context: AssembledContext) => void;
}

type Tab = "rules" | "memory" | "web" | "preview";

export default function ContextPanel({ projectId, machineId, projectPath, onClose, onAssembled }: Props) {
  const [tab, setTab] = useState<Tab>("rules");

  // Rules state
  const [rules, setRules] = useState<ProjectRule[]>([]);
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleContent, setNewRuleContent] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState<RuleCategory>("general");

  // Memory state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showNewMemory, setShowNewMemory] = useState(false);
  const [newMemKey, setNewMemKey] = useState("");
  const [newMemContent, setNewMemContent] = useState("");
  const [newMemCategory, setNewMemCategory] = useState<MemoryCategory>("general");
  const [newMemGlobal, setNewMemGlobal] = useState(false);

  // Web state
  const [webUrl, setWebUrl] = useState("");
  const [webQuery, setWebQuery] = useState("");
  const [webResults, setWebResults] = useState<{ url: string; title: string; snippet: string }[]>([]);
  const [webLoading, setWebLoading] = useState(false);

  // Preview state
  const [previewPrompt, setPreviewPrompt] = useState("");
  const [assembled, setAssembled] = useState<AssembledContext | null>(null);
  const [assembling, setAssembling] = useState(false);

  // ── Load data ──
  useEffect(() => {
    listRules(projectId).then(setRules);
    listMemories(projectId).then(setMemories);
  }, [projectId]);

  // ── Rules CRUD ──
  const handleCreateRule = useCallback(async () => {
    if (!newRuleName.trim() || !newRuleContent.trim()) return;
    const rule = await createRule(projectId, newRuleName.trim(), newRuleContent.trim(), newRuleCategory);
    setRules((prev) => [...prev, rule]);
    setShowNewRule(false);
    setNewRuleName("");
    setNewRuleContent("");
    setNewRuleCategory("general");
  }, [projectId, newRuleName, newRuleContent, newRuleCategory]);

  const handleToggleRule = useCallback(async (rule: ProjectRule) => {
    const updated = await updateRule(rule.id, { isActive: !rule.isActive });
    setRules((prev) => prev.map((r) => r.id === rule.id ? updated : r));
  }, []);

  const handleDeleteRule = useCallback(async (id: string) => {
    await deleteRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── Memory CRUD ──
  const handleCreateMemory = useCallback(async () => {
    if (!newMemKey.trim() || !newMemContent.trim()) return;
    const mem = await createMemory(newMemKey.trim(), newMemContent.trim(), newMemCategory, projectId, newMemGlobal);
    setMemories((prev) => [...prev, mem]);
    setShowNewMemory(false);
    setNewMemKey("");
    setNewMemContent("");
    setNewMemCategory("general");
    setNewMemGlobal(false);
  }, [projectId, newMemKey, newMemContent, newMemCategory, newMemGlobal]);

  const handleDeleteMemory = useCallback(async (id: string) => {
    await deleteMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // ── Web search ──
  const handleWebSearch = useCallback(async () => {
    if (!webQuery.trim()) return;
    setWebLoading(true);
    try {
      const results = await searchWeb(webQuery.trim());
      setWebResults(results);
    } catch { /* ok */ }
    setWebLoading(false);
  }, [webQuery]);

  const handleFetchUrl = useCallback(async () => {
    if (!webUrl.trim()) return;
    setWebLoading(true);
    try {
      const result = await fetchUrl(webUrl.trim());
      await saveWebResearch(result.url, result.title, result.content);
    } catch { /* ok */ }
    setWebLoading(false);
    setWebUrl("");
  }, [webUrl]);

  // ── Assemble context ──
  const handleAssemble = useCallback(async () => {
    if (!previewPrompt.trim()) return;
    setAssembling(true);
    try {
      const result = await assembleContext({
        prompt: previewPrompt.trim(),
        projectId,
        machineId: machineId || undefined,
        projectPath,
        maxTokens: 8000,
      });
      setAssembled(result);
    } catch { /* ok */ }
    setAssembling(false);
  }, [previewPrompt, projectId, machineId, projectPath]);

  const handleUseContext = useCallback(() => {
    if (assembled && onAssembled) {
      onAssembled(assembled);
      onClose();
    }
  }, [assembled, onAssembled, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[650px] mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text">Kontekst engine</span>
            <span className="text-[9px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded">
              {rules.length} pravila · {memories.length} sjećanja
            </span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {([["rules", "Pravila"], ["memory", "Sjećanja"], ["web", "Web"], ["preview", "Preview"]] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-3 py-2 text-[11px] font-medium border-b-2 -mb-px transition-colors ${
                tab === t ? "text-text border-accent" : "text-text-muted border-transparent hover:text-text-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* ── Rules Tab ── */}
          {tab === "rules" && (
            <>
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-text-muted uppercase tracking-wider">Pravila projekta</div>
                <button onClick={() => setShowNewRule(true)} className="text-[10px] text-accent hover:underline">+ Novo pravilo</button>
              </div>

              {showNewRule && (
                <div className="bg-[#141824] rounded-lg border border-[#2d3750] p-3 space-y-2">
                  <input value={newRuleName} onChange={(e) => setNewRuleName(e.target.value)} placeholder="Naziv pravila" className="w-full px-2 py-1 bg-[#0e1422] text-text text-[11px] rounded border border-[#202838] focus:border-accent outline-none" />
                  <textarea value={newRuleContent} onChange={(e) => setNewRuleContent(e.target.value)} placeholder="Sadržaj pravila…" className="w-full h-16 px-2 py-1 bg-[#0e1422] text-text text-[11px] rounded border border-[#202838] focus:border-accent outline-none resize-none" />
                  <div className="flex items-center gap-1 flex-wrap">
                    {RULE_CATEGORIES.map((c) => (
                      <button key={c.id} onClick={() => setNewRuleCategory(c.id)} className={`px-1.5 py-0.5 text-[8px] rounded border transition-colors ${newRuleCategory === c.id ? "border-accent bg-accent/10 text-accent" : "border-[#202838] text-text-muted"}`}>
                        {c.icon} {c.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => setShowNewRule(false)} className="px-2 py-1 text-[9px] text-text-muted hover:text-text rounded">Odustani</button>
                    <button onClick={handleCreateRule} disabled={!newRuleName.trim() || !newRuleContent.trim()} className="px-2 py-1 text-[9px] font-medium bg-accent text-white rounded disabled:opacity-30">Spremi</button>
                  </div>
                </div>
              )}

              {rules.length === 0 && !showNewRule && (
                <div className="text-center py-8 text-text-muted text-[11px]">Nema pravila. Dodaj prvo pravilo za projekat.</div>
              )}

              {rules.map((rule) => (
                <div key={rule.id} className={`bg-[#141824] rounded-lg border p-2.5 transition-colors ${rule.isActive ? "border-[#2d3750]" : "border-[#202838] opacity-50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px]">{RULE_CATEGORIES.find((c) => c.id === rule.category)?.icon || "📋"}</span>
                        <span className="text-[11px] font-medium text-text">{rule.name}</span>
                        <span className="text-[8px] text-text-muted bg-surface-2 px-1 py-0.5 rounded">{rule.category}</span>
                      </div>
                      <div className="text-[10px] text-text-muted mt-1 line-clamp-2">{rule.content}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleToggleRule(rule)} className={`px-1.5 py-0.5 text-[8px] rounded transition-colors ${rule.isActive ? "text-accent hover:bg-accent/10" : "text-text-muted hover:bg-surface-2"}`}>
                        {rule.isActive ? "Aktivno" : "Isključeno"}
                      </button>
                      <button onClick={() => handleDeleteRule(rule.id)} className="px-1.5 py-0.5 text-[8px] text-text-muted hover:text-red-400 rounded hover:bg-red-400/10">✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── Memory Tab ── */}
          {tab === "memory" && (
            <>
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-text-muted uppercase tracking-wider">Sjećanja</div>
                <button onClick={() => setShowNewMemory(true)} className="text-[10px] text-accent hover:underline">+ Novo sjećanje</button>
              </div>

              {showNewMemory && (
                <div className="bg-[#141824] rounded-lg border border-[#2d3750] p-3 space-y-2">
                  <input value={newMemKey} onChange={(e) => setNewMemKey(e.target.value)} placeholder="Ključ (npr. 'preferirani_stil')" className="w-full px-2 py-1 bg-[#0e1422] text-text text-[11px] rounded border border-[#202838] focus:border-accent outline-none" />
                  <textarea value={newMemContent} onChange={(e) => setNewMemContent(e.target.value)} placeholder="Sadržaj sjećanja…" className="w-full h-16 px-2 py-1 bg-[#0e1422] text-text text-[11px] rounded border border-[#202838] focus:border-accent outline-none resize-none" />
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 flex-wrap flex-1">
                      {MEMORY_CATEGORIES.map((c) => (
                        <button key={c.id} onClick={() => setNewMemCategory(c.id)} className={`px-1.5 py-0.5 text-[8px] rounded border transition-colors ${newMemCategory === c.id ? "border-accent bg-accent/10 text-accent" : "border-[#202838] text-text-muted"}`}>
                          {c.icon} {c.label}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-1 text-[8px] text-text-muted cursor-pointer">
                      <input type="checkbox" checked={newMemGlobal} onChange={(e) => setNewMemGlobal(e.target.checked)} className="w-3 h-3 accent-accent" />
                      Globalno
                    </label>
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => setShowNewMemory(false)} className="px-2 py-1 text-[9px] text-text-muted hover:text-text rounded">Odustani</button>
                    <button onClick={handleCreateMemory} disabled={!newMemKey.trim() || !newMemContent.trim()} className="px-2 py-1 text-[9px] font-medium bg-accent text-white rounded disabled:opacity-30">Spremi</button>
                  </div>
                </div>
              )}

              {memories.length === 0 && !showNewMemory && (
                <div className="text-center py-8 text-text-muted text-[11px]">Nema sjećanja. Dodaj sjećanje za kontekst.</div>
              )}

              {memories.map((mem) => (
                <div key={mem.id} className="bg-[#141824] rounded-lg border border-[#2d3750] p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px]">{MEMORY_CATEGORIES.find((c) => c.id === mem.category)?.icon || "📝"}</span>
                        <span className="text-[11px] font-medium text-text font-mono">{mem.key}</span>
                        {mem.isGlobal && <span className="text-[8px] text-accent bg-accent/10 px-1 py-0.5 rounded">global</span>}
                      </div>
                      <div className="text-[10px] text-text-muted mt-1 line-clamp-2">{mem.content}</div>
                    </div>
                    <button onClick={() => handleDeleteMemory(mem.id)} className="px-1.5 py-0.5 text-[8px] text-text-muted hover:text-red-400 rounded hover:bg-red-400/10 shrink-0">✕</button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── Web Tab ── */}
          {tab === "web" && (
            <>
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Web Research</div>

              {/* URL fetch */}
              <div className="flex gap-1.5">
                <input value={webUrl} onChange={(e) => setWebUrl(e.target.value)} placeholder="Unesi URL za preuzimanje…" className="flex-1 px-2 py-1 bg-[#0e1422] text-text text-[11px] rounded border border-[#202838] focus:border-accent outline-none" />
                <button onClick={handleFetchUrl} disabled={!webUrl.trim() || webLoading} className="px-2.5 py-1 text-[10px] bg-accent/10 text-accent rounded hover:bg-accent/20 disabled:opacity-30">Preuzmi</button>
              </div>

              {/* Search */}
              <div className="flex gap-1.5">
                <input value={webQuery} onChange={(e) => setWebQuery(e.target.value)} placeholder="Pretraži web…" className="flex-1 px-2 py-1 bg-[#0e1422] text-text text-[11px] rounded border border-[#202838] focus:border-accent outline-none" onKeyDown={(e) => e.key === "Enter" && handleWebSearch()} />
                <button onClick={handleWebSearch} disabled={!webQuery.trim() || webLoading} className="px-2.5 py-1 text-[10px] bg-accent/10 text-accent rounded hover:bg-accent/20 disabled:opacity-30">🔍</button>
              </div>

              {webLoading && <div className="text-center py-4 text-text-muted text-[11px]">Pretražujem…</div>}

              {webResults.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[9px] text-text-muted uppercase tracking-wider">{webResults.length} rezultata</div>
                  {webResults.map((r) => (
                    <div key={r.url} className="bg-[#141824] rounded-lg border border-[#2d3750] p-2.5 hover:border-accent/30 transition-colors">
                      <div className="text-[11px] font-medium text-text truncate">{r.title}</div>
                      <div className="text-[9px] text-accent/60 truncate mt-0.5">{r.url}</div>
                      <div className="text-[10px] text-text-muted mt-1 line-clamp-2">{r.snippet}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Preview Tab ── */}
          {tab === "preview" && (
            <>
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Sastavi kontekst</div>

              <textarea
                value={previewPrompt}
                onChange={(e) => setPreviewPrompt(e.target.value)}
                placeholder="Unesi prompt za koji želiš vidjeti kontekst…"
                className="w-full h-20 px-2 py-1 bg-[#0e1422] text-text text-[11px] rounded border border-[#202838] focus:border-accent outline-none resize-none"
              />

              <button
                onClick={handleAssemble}
                disabled={!previewPrompt.trim() || assembling}
                className="w-full py-1.5 text-[11px] font-medium bg-accent/10 text-accent rounded-lg hover:bg-accent/20 disabled:opacity-30 transition-colors"
              >
                {assembling ? "Sastavljam…" : "📊 Sastavi kontekst"}
              </button>

              {assembled && (
                <div className="space-y-2">
                  {/* Summary */}
                  <div className="flex items-center justify-between bg-[#141824] rounded-lg px-2.5 py-2 border border-[#2d3750]">
                    <span className="text-[10px] text-text-muted">Sažetak</span>
                    <span className="text-[10px] text-text-secondary font-mono">{assembled.summary}</span>
                  </div>

                  {/* Token bar */}
                  <div className="bg-[#141824] rounded-lg px-2.5 py-2 border border-[#2d3750]">
                    <div className="flex items-center justify-between text-[9px] text-text-muted mb-1">
                      <span>Tokeni</span>
                      <span>{assembled.totalTokens} / 8000</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#1a2130] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${assembled.truncated ? "bg-yellow-500" : "bg-accent"}`}
                        style={{ width: `${Math.min((assembled.totalTokens / 8000) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Sources */}
                  {assembled.sources.map((src, i) => (
                    <div key={i} className="bg-[#141824] rounded-lg border border-[#2d3750] p-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px]">{SOURCE_ICONS[src.type] || "📝"}</span>
                          <span className="text-[10px] font-medium text-text">{src.label}</span>
                        </div>
                        <span className="text-[8px] text-text-muted font-mono">{src.tokenCount} tok</span>
                      </div>
                      <div className="text-[9px] text-text-muted mt-1 line-clamp-3 font-mono">{src.content.slice(0, 200)}…</div>
                    </div>
                  ))}

                  <button
                    onClick={handleUseContext}
                    className="w-full py-1.5 text-[11px] font-medium bg-accent text-white rounded-lg hover:bg-accent-light transition-colors"
                  >
                    Koristi ovaj kontekst
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
