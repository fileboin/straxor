import { useState, useCallback } from "react";
import {
  generateImage,
  generateWebsite,
  generateUIComponent,
  generatePresentation,
  generateDesignSystem,
  listMedia,
  searchMedia,
  deleteMedia,
  listWebsites,
  listUIComponents,
  type ImageGenerationResult,
  type GeneratedWebsite,
  type GeneratedUIComponent,
  type GeneratedPresentation,
  type DesignSystem,
  type MediaItem,
} from "../../lib/design.js";

type Tab = "generate" | "media" | "websites" | "ui-components";

interface Props {
  onClose: () => void;
}

export default function DesignStudio({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("generate");
  // Generate tab
  const [prompt, setPrompt] = useState("");
  const [genType, setGenType] = useState<"website" | "ui" | "image" | "presentation" | "design-system">("website");
  const [imageProvider, setImageProvider] = useState("flux");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [resultType, setResultType] = useState<string>("");
  const [error, setError] = useState("");

  // Image-specific
  const [imgWidth, setImgWidth] = useState(1024);
  const [imgHeight, setImgHeight] = useState(1024);
  const [imgSteps, setImgSteps] = useState(20);
  const [imgStyle, setImgStyle] = useState("");

  // Media tab
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaLoading, setMediaLoading] = useState(false);

  // List tabs
  const [websites, setWebsites] = useState<GeneratedWebsite[]>([]);
  const [uiComponents, setUiComponents] = useState<GeneratedUIComponent[]>([]);

  // Preview modal
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError("");
    setResult(null);

    try {
      switch (genType) {
        case "image": {
          const img = await generateImage({
            prompt,
            provider: imageProvider,
            width: imgWidth,
            height: imgHeight,
            steps: imgSteps,
            style: imgStyle || undefined,
          });
          setResult(img);
          setResultType("image");
          break;
        }
        case "website": {
          const site = await generateWebsite(prompt, imgStyle || undefined);
          setResult(site);
          setResultType("website");
          break;
        }
        case "ui": {
          const comp = await generateUIComponent(prompt, imgStyle || undefined);
          setResult(comp);
          setResultType("ui");
          break;
        }
        case "presentation": {
          const pres = await generatePresentation(prompt, imgStyle || undefined);
          setResult(pres);
          setResultType("presentation");
          break;
        }
        case "design-system": {
          const ds = await generateDesignSystem(prompt);
          setResult(ds);
          setResultType("design-system");
          break;
        }
      }
    } catch (err: any) {
      setError(err.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [prompt, genType, imageProvider, imgWidth, imgHeight, imgSteps, imgStyle]);

  const handleLoadMedia = useCallback(async () => {
    setMediaLoading(true);
    try {
      const items = mediaSearch ? await searchMedia(mediaSearch) : await listMedia();
      setMediaItems(items);
    } catch {} finally {
      setMediaLoading(false);
    }
  }, [mediaSearch]);

  const handleDeleteMedia = useCallback(async (id: string) => {
    try {
      await deleteMedia(id);
      setMediaItems((prev) => prev.filter((i) => i.id !== id));
    } catch {}
  }, []);

  const handleLoadWebsites = useCallback(async () => {
    try {
      const items = await listWebsites();
      setWebsites(items);
    } catch {}
  }, []);

  const handleLoadUIComponents = useCallback(async () => {
    try {
      const items = await listUIComponents();
      setUiComponents(items);
    } catch {}
  }, []);

  const openPreview = useCallback((html: string, title: string) => {
    setPreviewHtml(html);
    setPreviewTitle(title);
    setShowPreview(true);
  }, []);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "generate", label: "Generator", icon: "✨" },
    { id: "media", label: "Media Library", icon: "🖼" },
    { id: "websites", label: "Websites", icon: "🌐" },
    { id: "ui-components", label: "UI Components", icon: "🧩" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-xl">🎨</div>
            <div>
              <h1 className="text-[15px] font-bold text-text">Design Studio</h1>
              <p className="text-[11px] text-text-muted">AI Website builder — prompt u dizajn</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-2 border-b border-border/50 shrink-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); if (t.id === "websites") handleLoadWebsites(); if (t.id === "ui-components") handleLoadUIComponents(); if (t.id === "media") handleLoadMedia(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                tab === t.id ? "bg-accent/15 text-accent border border-accent/30" : "text-text-muted hover:text-text-secondary border border-transparent"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {tab === "generate" && (
            <div className="space-y-4">
              {/* Type selector */}
              <div className="flex flex-wrap gap-2">
                {(["website", "ui", "image", "presentation", "design-system"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setGenType(t)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                      genType === t
                        ? "bg-accent/15 text-accent border-accent/30"
                        : "bg-surface-2/50 text-text-muted border-border hover:border-accent/30"
                    }`}
                  >
                    {t === "website" && "🌐 "}
                    {t === "ui" && "🧩 "}
                    {t === "image" && "🖼 "}
                    {t === "presentation" && "📊 "}
                    {t === "design-system" && "🎨 "}
                    {t.charAt(0).toUpperCase() + t.slice(1).replace("-", " ")}
                  </button>
                ))}
              </div>

              {/* Provider selector (for image type) */}
              {genType === "image" && (
                <div className="flex flex-wrap gap-2">
                  {["flux", "gpt-image", "gemini-image", "comfy-ui", "stable-diffusion"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setImageProvider(p)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                        imageProvider === p
                          ? "bg-accent/15 text-accent border-accent/30"
                          : "bg-surface-2/50 text-text-muted border-border hover:border-accent/30"
                      }`}
                    >
                      {p === "flux" ? "⚡ FLUX" : p === "gpt-image" ? "🔮 DALL-E" : p === "gemini-image" ? "🌀 Gemini" : p === "comfy-ui" ? "⚙ ComfyUI" : "🖨 SD"}
                    </button>
                  ))}
                </div>
              )}

              {/* Dimensions (for image) */}
              {genType === "image" && (
                <div className="flex gap-3">
                  <div>
                    <label className="text-[10px] text-text-muted block mb-1">Width</label>
                    <input type="number" value={imgWidth} onChange={(e) => setImgWidth(Number(e.target.value))} className="w-24 bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[12px] text-text" />
                  </div>
                  <div>
                    <label className="text-[10px] text-text-muted block mb-1">Height</label>
                    <input type="number" value={imgHeight} onChange={(e) => setImgHeight(Number(e.target.value))} className="w-24 bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[12px] text-text" />
                  </div>
                  <div>
                    <label className="text-[10px] text-text-muted block mb-1">Steps</label>
                    <input type="number" value={imgSteps} onChange={(e) => setImgSteps(Number(e.target.value))} className="w-20 bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[12px] text-text" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-text-muted block mb-1">Style</label>
                    <input type="text" value={imgStyle} onChange={(e) => setImgStyle(e.target.value)} placeholder="e.g., cinematic, minimal" className="w-full bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[12px] text-text placeholder:text-text-muted/50" />
                  </div>
                </div>
              )}

              {/* Prompt input */}
              <div>
                <label className="text-[11px] text-text-muted block mb-1.5">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    genType === "website" ? "Describe the website you want..." :
                    genType === "ui" ? "Describe the UI component..." :
                    genType === "image" ? "Describe the image..." :
                    genType === "presentation" ? "Presentation topic..." :
                    "Describe the design system style..."
                  }
                  rows={3}
                  className="w-full bg-surface-3 border border-border rounded-xl px-3 py-2 text-[12px] text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 transition-colors resize-none"
                />
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="w-full py-2.5 rounded-xl bg-accent text-white text-[12px] font-semibold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? "Generating..." : "✨ Generate"}
              </button>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-400">{error}</div>
              )}

              {/* Result */}
              {result && resultType === "image" && (
                <div className="p-3 rounded-xl bg-surface-2/50 border border-border">
                  <img src={(result as ImageGenerationResult).url} alt={(result as ImageGenerationResult).prompt} className="w-full max-h-96 object-contain rounded-lg" />
                  <div className="mt-2 text-[10px] text-text-muted">
                    Seed: {(result as ImageGenerationResult).seed} · {(result as ImageGenerationResult).width}x{(result as ImageGenerationResult).height} · ${(result as ImageGenerationResult).cost.toFixed(4)} · {(result as ImageGenerationResult).durationMs}ms
                  </div>
                </div>
              )}

              {result && resultType === "website" && (
                <div className="p-3 rounded-xl bg-surface-2/50 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] text-text-muted">{(result as GeneratedWebsite).id}</div>
                    <button
                      onClick={() => openPreview((result as GeneratedWebsite).html, (result as GeneratedWebsite).prompt)}
                      className="text-[11px] text-accent hover:underline"
                    >
                      Preview
                    </button>
                  </div>
                  <pre className="text-[10px] text-text-muted max-h-60 overflow-y-auto bg-black/30 rounded-lg p-2">
                    {((result as GeneratedWebsite).html || "").slice(0, 2000)}
                    {((result as GeneratedWebsite).html || "").length > 2000 ? "..." : ""}
                  </pre>
                </div>
              )}

              {result && resultType === "ui" && (
                <div className="p-3 rounded-xl bg-surface-2/50 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-medium text-text">{(result as GeneratedUIComponent).name}</div>
                    <span className="text-[10px] text-text-muted">{(result as GeneratedUIComponent).framework}</span>
                  </div>
                  <pre className="text-[10px] text-text-muted max-h-60 overflow-y-auto bg-black/30 rounded-lg p-2 font-mono">
                    {(result as GeneratedUIComponent).code}
                  </pre>
                </div>
              )}

              {result && resultType === "presentation" && (
                <div className="p-3 rounded-xl bg-surface-2/50 border border-border">
                  <div className="text-[13px] font-semibold text-text mb-2">{(result as GeneratedPresentation).title}</div>
                  <div className="space-y-2 mb-3">
                    {(result as GeneratedPresentation).slides.map((s: any, i: number) => (
                      <div key={i} className="p-2 rounded-lg bg-surface-3/50 border border-border/50">
                        <div className="text-[11px] font-medium text-text">Slide {i + 1}: {s.title}</div>
                        <div className="text-[10px] text-text-muted">{s.content}</div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => openPreview((result as GeneratedPresentation).html, (result as GeneratedPresentation).title)}
                    className="text-[11px] text-accent hover:underline"
                  >
                    Open Presentation
                  </button>
                </div>
              )}

              {result && resultType === "design-system" && (
                <div className="p-3 rounded-xl bg-surface-2/50 border border-border">
                  <div className="text-[13px] font-semibold text-text mb-2">{(result as DesignSystem).name}</div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {(result as DesignSystem).tokens.filter((t: any) => t.category === "color").map((t: any) => (
                      <div key={t.name} className="flex items-center gap-2 p-1.5 rounded-lg bg-surface-3/50">
                        <div className="w-5 h-5 rounded border border-border/50" style={{ background: t.value }} />
                        <span className="text-[10px] text-text-muted">{t.name}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => openPreview((result as DesignSystem).previewHtml, (result as DesignSystem).name)}
                    className="text-[11px] text-accent hover:underline"
                  >
                    Preview Design System
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "media" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mediaSearch}
                  onChange={(e) => setMediaSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLoadMedia()}
                  placeholder="Search media..."
                  className="flex-1 bg-surface-3 border border-border rounded-xl px-3 py-2 text-[12px] text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
                />
                <button onClick={handleLoadMedia} className="px-3 py-2 rounded-xl bg-accent text-white text-[11px] font-medium hover:bg-accent/90 transition-colors">Search</button>
              </div>
              {mediaLoading ? (
                <div className="text-[11px] text-text-muted">Loading...</div>
              ) : mediaItems.length === 0 ? (
                <div className="text-[11px] text-text-muted text-center py-8">No media items yet. Generate something first!</div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {mediaItems.map((item) => (
                    <div key={item.id} className="p-2 rounded-xl bg-surface-2/50 border border-border group relative">
                      {item.type === "image" && (
                        <img src={item.url} alt={item.alt || item.name} className="w-full h-24 object-cover rounded-lg" />
                      )}
                      <div className="mt-1.5 text-[10px] text-text-muted truncate">{item.name}</div>
                      <div className="text-[9px] text-text-muted/50">{item.folder}</div>
                      <button
                        onClick={() => handleDeleteMedia(item.id)}
                        className="absolute top-3 right-3 w-6 h-6 rounded-lg bg-red-500/80 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "websites" && (
            <div className="space-y-2">
              {websites.length === 0 ? (
                <div className="text-[11px] text-text-muted text-center py-8">No websites generated yet.</div>
              ) : (
                websites.map((site) => (
                  <div key={site.id} className="p-3 rounded-xl bg-surface-2/50 border border-border flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-text truncate">{site.prompt}</div>
                      <div className="text-[9px] text-text-muted">{site.id} · {new Date(site.createdAt).toLocaleString()}</div>
                    </div>
                    <button onClick={() => openPreview(site.html, site.prompt)} className="text-[10px] text-accent hover:underline shrink-0 ml-3">Preview</button>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "ui-components" && (
            <div className="space-y-2">
              {uiComponents.length === 0 ? (
                <div className="text-[11px] text-text-muted text-center py-8">No UI components generated yet.</div>
              ) : (
                uiComponents.map((comp) => (
                  <div key={comp.id} className="p-3 rounded-xl bg-surface-2/50 border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[11px] font-medium text-text">{comp.name}</div>
                      <span className="text-[9px] text-text-muted bg-surface-3 px-1.5 py-0.5 rounded">{comp.framework}</span>
                    </div>
                    <div className="text-[9px] text-text-muted">{comp.prompt}</div>
                    <pre className="text-[9px] text-text-muted/70 mt-1 max-h-20 overflow-y-auto bg-black/20 rounded p-1 font-mono">{comp.code.slice(0, 300)}</pre>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-border shrink-0">
          <div className="text-[9px] text-text-muted">Design Studio v1 · Prompt → Output</div>
          <div className="text-[9px] text-text-muted">Faza 4 — Expansion</div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowPreview(false)}>
          <div className="w-full max-w-4xl mx-4 bg-surface border border-border rounded-2xl overflow-hidden h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
              <h2 className="text-[13px] font-semibold text-text truncate">{previewTitle}</h2>
              <button onClick={() => setShowPreview(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors text-[11px]">✕</button>
            </div>
            <iframe
              srcDoc={previewHtml}
              className="flex-1 w-full bg-white"
              title="Preview"
              sandbox="allow-scripts"
            />
          </div>
        </div>
      )}
    </div>
  );
}
