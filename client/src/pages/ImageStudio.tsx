import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import * as ImageAPI from "../lib/image.js";

type Tab = "generate" | "library" | "styles" | "templates" | "branding" | "providers" | "costs";

export default function ImageStudio() {
  const { id: projectId } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("generate");

  return (
    <div className="h-full flex flex-col bg-bg text-text">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface">
        <h1 className="text-lg font-bold">🎨 Image Studio</h1>
        <span className="text-xs text-text-secondary bg-bg px-3 py-1 rounded-full border border-border">
          {projectId || "No project"}
        </span>
      </div>

      <div className="flex gap-1 px-6 pt-3 border-b border-border overflow-x-auto">
        {(["generate", "library", "styles", "templates", "branding", "providers", "costs"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              tab === t ? "bg-bg border border-border border-b-transparent text-text" : "text-text-secondary hover:text-text"
            }`}
          >
            {t === "generate" ? "✨ Generate" : t === "library" ? "🖼 Library" : t === "styles" ? "🎭 Styles" : t === "templates" ? "📋 Templates" : t === "branding" ? "🏷 Branding" : t === "providers" ? "🔌 Providers" : "💰 Costs"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "generate" && <GenerateTab projectId={projectId} />}
        {tab === "library" && <LibraryTab projectId={projectId} />}
        {tab === "styles" && <StylesTab />}
        {tab === "templates" && <TemplatesTab />}
        {tab === "branding" && <BrandingTab projectId={projectId} />}
        {tab === "providers" && <ProvidersTab />}
        {tab === "costs" && <CostsTab projectId={projectId} />}
      </div>
    </div>
  );
}

function GenerateTab({ projectId }: { projectId?: string }) {
  const [prompt, setPrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState("");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [numImages, setNumImages] = useState(1);
  const [quality, setQuality] = useState<"draft" | "standard" | "hd">("standard");
  const [styleId, setStyleId] = useState("");
  const [provider, setProvider] = useState("");
  const [assetType, setAssetType] = useState("");
  const [styles, setStyles] = useState<ImageAPI.ImageStyle[]>([]);
  const [providers, setProviders] = useState<ImageAPI.ProviderInfo[]>([]);
  const [specs, setSpecs] = useState<ImageAPI.AssetSpec[]>([]);
  const [results, setResults] = useState<ImageAPI.GenerationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    ImageAPI.listStyles().then(setStyles).catch(() => {});
    ImageAPI.listProviders().then(setProviders).catch(() => {});
    ImageAPI.listAssetSpecs().then(setSpecs).catch(() => {});
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const res = await ImageAPI.generateImage({
        prompt: prompt.trim(),
        negativePrompt: negPrompt || undefined,
        width, height, numImages, quality,
        styleId: styleId || undefined,
        provider: provider || undefined,
        assetType: assetType || undefined,
        projectId,
      });
      setResults(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [prompt, negPrompt, width, height, numImages, quality, styleId, provider, assetType, projectId]);

  const fillAsset = useCallback((spec: ImageAPI.AssetSpec) => {
    setWidth(spec.width);
    setHeight(spec.height);
    setAssetType(spec.type);
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <textarea
            placeholder="Describe the image you want to generate..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            className="w-full h-28 px-3 py-2 bg-bg border border-border rounded-lg text-sm resize-none focus:outline-none focus:border-accent"
          />
          <input
            placeholder="Negative prompt (what to avoid)"
            value={negPrompt}
            onChange={e => setNegPrompt(e.target.value)}
            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Width</label>
              <input type="number" value={width} onChange={e => setWidth(Number(e.target.value))} className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Height</label>
              <input type="number" value={height} onChange={e => setHeight(Number(e.target.value))} className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Count</label>
              <input type="number" min={1} max={4} value={numImages} onChange={e => setNumImages(Number(e.target.value))} className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Quality</label>
              <select value={quality} onChange={e => setQuality(e.target.value as any)} className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm">
                <option value="draft">Draft</option>
                <option value="standard">Standard</option>
                <option value="hd">HD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Style</label>
              <select value={styleId} onChange={e => setStyleId(e.target.value)} className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm">
                <option value="">None</option>
                {styles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Provider</label>
              <select value={provider} onChange={e => setProvider(e.target.value)} className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm">
                <option value="">Auto-select</option>
                {providers.map(p => <option key={p.name} value={p.name}>{p.displayName}</option>)}
              </select>
            </div>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-text-secondary hover:text-text">Quick asset presets</summary>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {specs.map(s => (
                <button key={s.type} onClick={() => fillAsset(s)} className="text-left px-2 py-1.5 text-xs bg-bg border border-border rounded hover:border-accent transition-colors">
                  <span className="font-medium">{s.type}</span>
                  <span className="text-text-secondary ml-1">({s.width}x{s.height} {s.format})</span>
                </button>
              ))}
            </div>
          </details>

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full py-2.5 bg-accent text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Generating..." : "✨ Generate"}
          </button>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-text-secondary">Results</h3>
          {results.length === 0 && !loading && (
            <div className="flex items-center justify-center h-64 bg-bg border border-dashed border-border rounded-lg text-text-secondary text-sm">
              Generated images will appear here
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center h-64 bg-bg border border-dashed border-border rounded-lg">
              <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
            </div>
          )}
          <div className="grid grid-cols-1 gap-3">
            {results.map(r => (
              <div key={r.id} className="bg-bg border border-border rounded-lg overflow-hidden">
                <img src={r.url} alt="Generated" className="w-full h-auto max-h-64 object-contain bg-black/5" />
                <div className="p-2 text-xs text-text-secondary space-y-0.5">
                  <div className="flex justify-between">
                    <span>{r.provider}{r.model ? ` (${r.model})` : ""}</span>
                    <span>${r.cost.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{r.width}x{r.height} · {r.format}</span>
                    <span>{r.duration}ms</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LibraryTab({ projectId }: { projectId?: string }) {
  const [images, setImages] = useState<ImageAPI.ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ImageAPI.ImageRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = search
        ? await ImageAPI.searchImages(search, projectId)
        : await ImageAPI.listImages(projectId);
      setImages(data);
    } catch { } finally { setLoading(false); }
  }, [projectId, search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    await ImageAPI.deleteImage(id);
    load();
    if (selected?.id === id) setSelected(null);
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <input
        placeholder="Search images by prompt or tags..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
      />

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>
      ) : images.length === 0 ? (
        <div className="text-center py-16 text-text-secondary text-sm">No images generated yet</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map(img => (
            <div
              key={img.id}
              onClick={() => setSelected(img)}
              className={`bg-bg border rounded-lg overflow-hidden cursor-pointer transition-all hover:border-accent ${selected?.id === img.id ? "border-accent ring-1 ring-accent" : "border-border"}`}
            >
              <img src={img.url} alt={img.prompt} className="w-full h-32 object-contain bg-black/5" />
              <div className="p-2 text-xs truncate">{img.prompt}</div>
              <div className="px-2 pb-2 flex justify-between text-[10px] text-text-secondary">
                <span>{img.width}x{img.height}</span>
                <span>{img.provider}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSelected(null)}>
          <div className="bg-surface rounded-xl border border-border max-w-2xl w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <img src={selected.url} alt={selected.prompt} className="w-full h-auto max-h-96 object-contain bg-black/10" />
            <div className="p-4 space-y-2 text-sm">
              <p className="font-medium">{selected.prompt}</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
                <span>Provider: {selected.provider}</span>
                <span>Size: {selected.width}x{selected.height}</span>
                <span>Format: {selected.format}</span>
                <span>Cost: ${selected.cost}</span>
                <span>Duration: {selected.duration}ms</span>
                <span>Quality: {selected.quality}</span>
              </div>
              {selected.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {selected.tags.map(t => <span key={t} className="px-2 py-0.5 bg-bg border border-border rounded text-[10px]">{t}</span>)}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <a href={selected.url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs">Open</a>
                <button onClick={() => handleDelete(selected.id)} className="px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-xs">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StylesTab() {
  const [styles, setStyles] = useState<ImageAPI.ImageStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("design");
  const [desc, setDesc] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setStyles(await ImageAPI.listStyles()); } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await ImageAPI.createStyle({
      name: name.trim(),
      category,
      description: desc,
      visualTraits: [],
    });
    setName(""); setDesc("");
    setShowNew(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await ImageAPI.deleteStyle(id);
    load();
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{styles.length} styles</p>
        <button onClick={() => setShowNew(!showNew)} className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium">
          + New Style
        </button>
      </div>

      {showNew && (
        <div className="bg-bg border border-border rounded-lg p-4 space-y-3">
          <input placeholder="Style name" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm" />
          <input placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm" />
          <textarea placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} className="w-full h-20 px-3 py-2 bg-surface border border-border rounded-lg text-sm resize-none" />
          <button onClick={handleCreate} className="px-4 py-2 bg-accent text-white rounded-lg text-sm">Save</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-text-secondary text-sm">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {styles.map(s => (
            <div key={s.id} className="bg-bg border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-sm">{s.name}</h3>
                  <span className="text-[10px] text-text-secondary bg-surface px-2 py-0.5 rounded">{s.category}</span>
                </div>
                {!s.isBuiltin && (
                  <button onClick={() => handleDelete(s.id)} className="text-red-500 text-xs hover:underline">Delete</button>
                )}
              </div>
              <p className="text-xs text-text-secondary">{s.description}</p>
              {s.colorPalette && (
                <div className="flex gap-1">
                  {s.colorPalette.map((c, i) => (
                    <div key={i} className="w-5 h-5 rounded border border-border" style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>
              )}
              {s.visualTraits.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {s.visualTraits.map((t, i) => <span key={i} className="px-2 py-0.5 bg-surface border border-border rounded text-[10px]">{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<ImageAPI.PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [template, setTemplate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setTemplates(await ImageAPI.listTemplates()); } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name.trim() || !template.trim()) return;
    await ImageAPI.createTemplate({ name: name.trim(), category, template: template.trim(), variables: [], tags: [] });
    setName(""); setTemplate("");
    setShowNew(false);
    load();
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{templates.length} templates</p>
        <button onClick={() => setShowNew(!showNew)} className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium">
          + New Template
        </button>
      </div>

      {showNew && (
        <div className="bg-bg border border-border rounded-lg p-4 space-y-3">
          <input placeholder="Template name" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm" />
          <input placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm" />
          <textarea placeholder="Template with {variables}" value={template} onChange={e => setTemplate(e.target.value)} className="w-full h-24 px-3 py-2 bg-surface border border-border rounded-lg text-sm resize-none" />
          <button onClick={handleCreate} className="px-4 py-2 bg-accent text-white rounded-lg text-sm">Save</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-text-secondary text-sm">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map(t => (
            <div key={t.id} className="bg-bg border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-sm">{t.name}</h3>
                  <span className="text-[10px] text-text-secondary bg-surface px-2 py-0.5 rounded">{t.category}</span>
                </div>
              </div>
              <pre className="text-xs text-text-secondary bg-surface p-2 rounded overflow-x-auto">{t.template}</pre>
              {t.variables.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {t.variables.map(v => <span key={v} className="px-2 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded text-[10px]">{`{${v}}`}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BrandingTab({ projectId }: { projectId?: string }) {
  const [brand, setBrand] = useState<ImageAPI.BrandIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try { setBrand(await ImageAPI.getBrand(projectId)); } catch {} finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!projectId || !name.trim()) return;
    setCreating(true);
    try {
      const b = await ImageAPI.createBrand(projectId, name.trim());
      setBrand(b);
    } catch {} finally { setCreating(false); }
  };

  if (!projectId) return <div className="text-text-secondary text-sm">Select a project to manage branding</div>;

  if (loading) return <div className="text-text-secondary text-sm">Loading...</div>;

  if (!brand) {
    return (
      <div className="space-y-4 max-w-md">
        <p className="text-sm text-text-secondary">No brand identity created yet for this project.</p>
        <div className="flex gap-2">
          <input placeholder="Brand name" value={name} onChange={e => setName(e.target.value)} className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm" />
          <button onClick={handleCreate} disabled={creating || !name.trim()} className="px-4 py-2 bg-accent text-white rounded-lg text-sm disabled:opacity-50">
            {creating ? "..." : "Create"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold">{brand.name}</h2>
        <p className="text-xs text-text-secondary">Visual identity: {brand.visualIdentity} · Icon style: {brand.iconStyle}</p>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Color Palette</h3>
        <div className="grid grid-cols-3 gap-3">
          {brand.colorPalette.map((c, i) => (
            <div key={i} className="flex items-center gap-2 bg-bg border border-border rounded-lg p-2">
              <div className="w-8 h-8 rounded border border-border shrink-0" style={{ backgroundColor: c.hex }} />
              <div className="text-xs">
                <p className="font-medium">{c.name}</p>
                <p className="text-text-secondary">{c.hex}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Typography</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-bg border border-border rounded-lg p-3">
            <span className="text-xs text-text-secondary">Heading</span>
            <p className="font-medium">{brand.typography.headingFont || "—"}</p>
          </div>
          <div className="bg-bg border border-border rounded-lg p-3">
            <span className="text-xs text-text-secondary">Body</span>
            <p className="font-medium">{brand.typography.bodyFont || "—"}</p>
          </div>
        </div>
      </div>

      {brand.assets.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Brand Assets</h3>
          <div className="grid grid-cols-3 gap-3">
            {brand.assets.map((a, i) => (
              <div key={i} className="bg-bg border border-border rounded-lg overflow-hidden">
                <img src={a.url} alt={a.type} className="w-full h-20 object-contain bg-black/5" />
                <p className="p-1.5 text-[10px] text-text-secondary">{a.type}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProvidersTab() {
  const [providers, setProviders] = useState<ImageAPI.ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setProviders(await ImageAPI.listProviders()); } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleProvider = async (name: string, current: boolean) => {
    await ImageAPI.updateProvider(name, { isEnabled: !current } as any);
    load();
  };

  return (
    <div className="space-y-4 max-w-3xl">
      {loading ? (
        <div className="text-center py-8 text-text-secondary text-sm">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {providers.map(p => (
            <div key={p.name} className={`bg-bg border rounded-lg p-4 ${p.available ? "border-border" : "border-dashed border-border/50"}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-medium text-sm">{p.displayName}</h3>
                  <span className="text-[10px] text-text-secondary">{p.name}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={p.isEnabled} onChange={() => toggleProvider(p.name, p.isEnabled)} className="sr-only peer" />
                  <div className="w-8 h-4 bg-border rounded-full peer peer-checked:bg-accent after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-3 after:h-3 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-4" />
                </label>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {p.supportedFormats.map(f => <span key={f} className="px-1.5 py-0.5 bg-surface border border-border rounded text-[10px]">{f}</span>)}
              </div>
              <div className="text-[10px] text-text-secondary space-y-0.5">
                <p>Max: {p.maxDimensions.width}x{p.maxDimensions.height}</p>
                <p>Cost: ${p.costPerImage.toFixed(4)}/img</p>
                <p className={p.available ? "text-green-500" : "text-red-500"}>{p.available ? "Available" : "Not configured"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CostsTab({ projectId }: { projectId?: string }) {
  const [costs, setCosts] = useState<ImageAPI.CostOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCosts(await ImageAPI.getCosts(projectId)); } catch {} finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-text-secondary text-sm">Loading...</div>;

  if (!costs) return <div className="text-text-secondary text-sm">No cost data</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-bg border border-border rounded-lg p-4">
          <p className="text-xs text-text-secondary">Total Cost</p>
          <p className="text-2xl font-bold">${costs.total.toFixed(4)}</p>
        </div>
        <div className="bg-bg border border-border rounded-lg p-4">
          <p className="text-xs text-text-secondary">Total Images</p>
          <p className="text-2xl font-bold">{costs.records.reduce((s, r) => s + r.totalCost, 0).toFixed(0)}</p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Cost by Provider</h3>
        <div className="space-y-2">
          {Object.entries(costs.byProvider).map(([provider, cost]) => (
            <div key={provider} className="flex items-center justify-between bg-bg border border-border rounded-lg px-4 py-2">
              <span className="text-sm font-medium">{provider}</span>
              <span className="text-sm">${cost.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Recent Records</h3>
        <div className="space-y-1">
          {costs.records.slice(-10).reverse().map(r => (
            <div key={r.id} className="flex items-center justify-between bg-bg border border-border rounded-lg px-3 py-1.5 text-xs">
              <span className="text-text-secondary">{r.provider}</span>
              <span>${r.totalCost.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
