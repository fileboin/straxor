import { useState, useEffect, useRef, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  generateImageAgent,
  listSessions,
  getSession,
  deleteSession,
  decomposePrompt,
  listDomainModes,
  listBrandPresets,
  type ImageAgentSession,
  type ImageAgentMessage,
  type DomainMode,
  type PromptComponents,
  type ImageAgentImageResult,
  type DomainModeConfig,
  type BrandPreset,
  VALID_ASPECT_RATIOS,
  VALID_RESOLUTIONS,
} from "../lib/image-agent.js";

export default function ImageAgent() {
  const navigate = useNavigate();
  const { id: projectId } = useParams<{ id: string }>();
  const [sessions, setSessions] = useState<ImageAgentSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ImageAgentMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [domainModes, setDomainModes] = useState<DomainModeConfig[]>([]);
  const [brandPresets, setBrandPresets] = useState<BrandPreset[]>([]);
  const [decomposed, setDecomposed] = useState<PromptComponents | null>(null);
  const [showSessions, setShowSessions] = useState(true);

  // Generation params
  const [prompt, setPrompt] = useState("");
  const [domainMode, setDomainMode] = useState<DomainMode | "">("");
  const [brandPresetId, setBrandPresetId] = useState("");
  const [aspectRatio, setAspectRatio] = useState("");
  const [resolution, setResolution] = useState("");
  const [batchCount, setBatchCount] = useState(1);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projectId) {
      listSessions(projectId).then(setSessions).catch(() => {});
    }
    listDomainModes().then(setDomainModes).catch(() => {});
    listBrandPresets().then(setBrandPresets).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSession = async (sessionId: string) => {
    try {
      const session = await getSession(sessionId);
      setActiveSessionId(session.id);
      setMessages(session.messages);
    } catch {
      setActiveSessionId(null);
      setMessages([]);
    }
  };

  const handleNewSession = () => {
    setActiveSessionId(null);
    setMessages([]);
    setPrompt("");
    setDecomposed(null);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) handleNewSession();
    } catch {}
  };

  const handleDecompose = async () => {
    if (!prompt.trim()) return;
    try {
      const comps = await decomposePrompt(prompt.trim());
      setDecomposed(comps);
    } catch {}
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    try {
      const result = await generateImageAgent({
        prompt: prompt.trim(),
        domainMode: domainMode || undefined,
        brandPresetId: brandPresetId || undefined,
        aspectRatio: aspectRatio || undefined,
        resolution: resolution || undefined,
        n: batchCount,
        sessionId: activeSessionId || undefined,
        projectId: projectId || "default",
      });
      setMessages(result.session.messages);
      setActiveSessionId(result.session.id);
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== result.session.id);
        return [result.session, ...filtered];
      });
      setPrompt("");
      setDecomposed(null);
    } catch (err: any) {
      const errMsg: ImageAgentMessage = {
        role: "system",
        content: `Error: ${err.message}`,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/project/${projectId || "unknown"}`)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-transparent text-text-secondary hover:text-text transition-colors"
          >
            ←
          </button>
          <h1 className="text-sm font-bold">Image Agent</h1>
          {activeSession && (
            <span className="text-[11px] text-text-muted px-2 py-0.5 rounded-md bg-surface-3 truncate max-w-[200px]">
              {activeSession.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSessions(!showSessions)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              showSessions
                ? "border-accent/30 bg-accent/5 text-accent"
                : "border-border bg-transparent text-text-secondary"
            }`}
          >
            Sessions
          </button>
          <button
            onClick={handleNewSession}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-transparent text-text-secondary hover:text-text transition-colors"
          >
            + New
          </button>
          <button
            onClick={() => navigate(`/project/${projectId || "unknown"}/image`)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-accent/30 bg-transparent text-accent hover:bg-accent/10 transition-colors"
          >
            Image Studio
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Session sidebar */}
        {showSessions && (
          <aside className="w-56 border-r border-border bg-surface overflow-y-auto shrink-0 hidden md:block">
            <div className="p-2 space-y-1">
              {sessions.length === 0 && (
                <p className="text-xs text-text-muted p-2">No sessions yet</p>
              )}
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors text-xs ${
                    s.id === activeSessionId
                      ? "bg-accent/10 text-accent border border-accent/20"
                      : "text-text-secondary hover:bg-surface-2 border border-transparent"
                  }`}
                >
                  <span className="truncate flex-1">{s.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(s.id);
                    }}
                    className="text-text-muted hover:text-danger transition-colors shrink-0"
                    title="Delete session"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Main area */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <p className="text-lg font-semibold text-text mb-2">Image Agent</p>
                  <p className="text-sm text-text-muted">
                    Describe the image you want to generate. The agent will decompose your prompt,
                    apply domain-specific optimizations, and generate stunning visuals.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {["A futuristic city skyline at sunset", "Minimalist logo for a SaaS company", "Product photo of a sleek water bottle"].map((ex) => (
                      <button
                        key={ex}
                        onClick={() => setPrompt(ex)}
                        className="text-xs px-3 py-1.5 rounded-full border border-border bg-surface-2 text-text-muted hover:text-text hover:border-border-light transition-colors"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Decomposed prompt preview */}
          {decomposed && (
            <div className="mx-4 mb-2 p-3 rounded-lg bg-surface-2 border border-border text-xs space-y-1">
              <p className="text-text-muted font-medium mb-1">Decomposed prompt:</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {Object.entries(decomposed).map(([key, val]) => (
                  val ? (
                    <div key={key} className="truncate">
                      <span className="text-accent capitalize">{key}:</span>{" "}
                      <span className="text-text-secondary">{val}</span>
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          )}

          {/* Controls + Input */}
          <form onSubmit={handleSubmit} className="border-t border-border bg-surface p-3 space-y-2 shrink-0">
            <div className="flex flex-wrap gap-2">
              <select
                value={domainMode}
                onChange={(e) => setDomainMode(e.target.value as DomainMode | "")}
                className="text-xs px-2 py-1.5 rounded-lg border border-border bg-bg text-text-secondary outline-none focus:border-accent transition-colors"
              >
                <option value="">No mode</option>
                {domainModes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.icon} {m.name}
                  </option>
                ))}
              </select>
              <select
                value={brandPresetId}
                onChange={(e) => setBrandPresetId(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg border border-border bg-bg text-text-secondary outline-none focus:border-accent transition-colors"
              >
                <option value="">No brand</option>
                {brandPresets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.icon} {b.name}
                  </option>
                ))}
              </select>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg border border-border bg-bg text-text-secondary outline-none focus:border-accent transition-colors"
              >
                <option value="">Auto ratio</option>
                {VALID_ASPECT_RATIOS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg border border-border bg-bg text-text-secondary outline-none focus:border-accent transition-colors"
              >
                <option value="">Auto resolution</option>
                {VALID_RESOLUTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
                value={batchCount}
                onChange={(e) => setBatchCount(Number(e.target.value))}
                className="text-xs px-2 py-1.5 rounded-lg border border-border bg-bg text-text-secondary outline-none focus:border-accent transition-colors"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n}x</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-bg border border-border text-text text-sm placeholder-text-muted outline-none focus:border-accent transition-colors"
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleDecompose}
                disabled={!prompt.trim()}
                className="px-3 py-2 rounded-xl border border-border bg-surface-2 text-text-secondary text-xs hover:text-text disabled:opacity-40 transition-colors"
                title="Decompose prompt"
              >
                🔍
              </button>
              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                className="px-4 py-2 rounded-xl bg-accent hover:opacity-90 disabled:opacity-50 text-sm font-semibold text-white transition-opacity"
              >
                {loading ? "Generating..." : "Generate"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ImageAgentMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const hasImages = message.imageResults && message.imageResults.length > 0;

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="px-4 py-2 rounded-xl bg-surface-3 border border-border text-xs text-text-muted max-w-lg text-center">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-accent/10 border border-accent/20 text-text"
            : "bg-surface-2 border border-border text-text"
        }`}
      >
        {message.domainMode && (
          <span className="text-[10px] text-accent font-medium uppercase tracking-wider block mb-1">
            {message.domainMode}
          </span>
        )}
        {message.promptComponents && !isUser && (
          <div className="flex flex-wrap gap-1 mb-2">
            {Object.entries(message.promptComponents).map(([key, val]) =>
              val ? (
                <span key={key} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-muted">
                  {key}: {val}
                </span>
              ) : null
            )}
          </div>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.promptText && !isUser && !hasImages && (
          <p className="text-[11px] text-text-muted mt-1 italic">
            Prompt: {message.promptText}
          </p>
        )}
        {hasImages && (
          <div className={`mt-3 grid gap-3 ${(message.imageResults?.length || 0) > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {message.imageResults?.map((img) => (
              <ImageCard key={img.id} image={img} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ImageCard({ image }: { image: ImageAgentImageResult }) {
  const [expanded, setExpanded] = useState(false);
  const imageUrl = image.b64 ? `data:image/${image.format};base64,${image.b64}` : image.url;

  if (!imageUrl) return null;

  return (
    <div className="relative group">
      <img
        src={imageUrl}
        alt={`Generated ${image.variationIndex !== undefined ? `variation ${image.variationIndex + 1}` : ""}`}
        className="w-full rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
        style={{ maxHeight: expanded ? "80vh" : "300px", objectFit: "contain" }}
        onClick={() => setExpanded(!expanded)}
      />
      <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
          {image.width}x{image.height}
        </span>
        {image.variationIndex !== undefined && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
            #{image.variationIndex + 1}
          </span>
        )}
        {image.provider !== "error" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
            ${image.cost.toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
}
