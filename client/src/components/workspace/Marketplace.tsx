import { useState, useEffect, useCallback } from "react";
import { marketplaceApi, type MarketplaceItem, type MarketplaceType } from "../../lib/marketplace";

interface Props {
  onClose: () => void;
}

type SortMode = "popular" | "newest" | "rating" | "name";

const TYPE_ICONS: Record<string, string> = {
  template: "📦",
  agent: "🤖",
  prompt: "📝",
  mcp: "🔌",
  workflow: "🔄",
  plugin: "🧩",
};

export default function Marketplace({ onClose }: Props) {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [types, setTypes] = useState<MarketplaceType[]>([]);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("popular");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<MarketplaceItem | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [publishForm, setPublishForm] = useState({ name: "", type: "template", description: "", category: "", content: "{}", tags: "" });
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await marketplaceApi.list({
        type: filterType || undefined, category: filterCategory || undefined,
        search: search || undefined, sort, limit: 20, offset: page * 20,
      });
      setItems(res.items);
      setTotal(res.total);
      setCategories(res.categories);
    } catch (err: any) { flash(err.message); }
    setLoading(false);
  }, [filterType, filterCategory, search, sort, page]);

  const loadTypes = useCallback(async () => {
    try {
      const res = await marketplaceApi.getTypes();
      setTypes(res.types);
    } catch (err: any) { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadTypes(); }, [loadTypes]);

  const seed = async () => {
    try {
      const res = await marketplaceApi.seed();
      flash(res.message);
      load();
    } catch (err: any) { flash(err.message); }
  };

  const handleInstall = async (id: string) => {
    try {
      const res = await marketplaceApi.install(id);
      flash(`Installed: ${res.item.name}`);
    } catch (err: any) { flash(err.message); }
  };

  const handlePublish = async () => {
    if (!publishForm.name.trim()) return;
    try {
      const item = await marketplaceApi.publish({
        ...publishForm,
        tags: publishForm.tags ? publishForm.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      });
      setItems((prev) => [item, ...prev]);
      setShowPublish(false);
      setPublishForm({ name: "", type: "template", description: "", category: "", content: "{}", tags: "" });
      flash("Published!");
    } catch (err: any) { flash(err.message); }
  };

  const handleReview = async () => {
    if (!selected) return;
    try {
      await marketplaceApi.addReview(selected.id, reviewForm);
      flash("Review added");
      setReviewForm({ rating: 5, comment: "" });

      const updated = await marketplaceApi.get(selected.id);
      setSelected(updated);
    } catch (err: any) { flash(err.message); }
  };

  const selectItem = async (item: MarketplaceItem) => {
    try {
      const detail = await marketplaceApi.get(item.id);
      setSelected(detail);
    } catch (err: any) { flash(err.message); }
  };

  const renderStars = (rating: number) => {
    const full = Math.floor(rating / 10);
    return "★".repeat(full) + "☆".repeat(Math.max(0, 5 - full));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <span className="text-lg">🏪</span>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-text">Marketplace</h1>
              <p className="text-[10px] text-text-muted">{total} community items</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={seed} className="px-3 py-1.5 bg-surface-dim border border-border text-text text-[11px] rounded-lg hover:bg-border">Seed Presets</button>
            <button onClick={() => setShowPublish(true)} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">+ Publish</button>
            <button onClick={onClose} className="text-text-muted hover:text-text text-sm px-2 py-1 rounded-lg hover:bg-surface-dim transition-colors">✕</button>
          </div>
        </div>

        {actionMsg && (
          <div className="mx-5 mt-2 px-3 py-1.5 bg-accent/10 text-accent text-[11px] rounded-lg">{actionMsg}</div>
        )}

        {showPublish && (
          <div className="px-5 pt-3 pb-2 border-b border-border">
            <div className="p-3 bg-surface-dim rounded-lg space-y-2">
              <div className="flex gap-2">
                <input value={publishForm.name} onChange={(e) => setPublishForm((p) => ({ ...p, name: e.target.value }))} placeholder="Item name"
                  className="flex-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                <select value={publishForm.type} onChange={(e) => setPublishForm((p) => ({ ...p, type: e.target.value }))}
                  className="px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text">
                  {types.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
                </select>
              </div>
              <input value={publishForm.category} onChange={(e) => setPublishForm((p) => ({ ...p, category: e.target.value }))} placeholder="Category (e.g. web, backend, cicd, agent)"
                className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
              <textarea value={publishForm.description} onChange={(e) => setPublishForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description" rows={2}
                className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
              <input value={publishForm.tags} onChange={(e) => setPublishForm((p) => ({ ...p, tags: e.target.value }))} placeholder="Tags (comma separated: react, typescript, api)"
                className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
              <div className="flex gap-2">
                <button onClick={handlePublish} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">Publish</button>
                <button onClick={() => setShowPublish(false)} className="px-3 py-1.5 text-text-muted text-[11px]">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-border overflow-x-auto shrink-0">
          <div className="flex gap-1">
            <button onClick={() => { setFilterType(""); setPage(0); }}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors whitespace-nowrap ${!filterType ? "bg-accent text-white" : "text-text-muted hover:text-text"}`}>All</button>
            {types.map((t) => (
              <button key={t.id} onClick={() => { setFilterType(filterType === t.id ? "" : t.id); setPage(0); }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors whitespace-nowrap ${filterType === t.id ? "bg-accent text-white" : "text-text-muted hover:text-text"}`}>
                {t.icon} {t.name}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search..."
              className="w-40 px-2 py-1 bg-surface-dim border border-border rounded-lg text-[10px] text-text placeholder:text-text-muted" />
            <select value={sort} onChange={(e) => { setSort(e.target.value as SortMode); setPage(0); }}
              className="px-2 py-1 bg-surface-dim border border-border rounded-lg text-[10px] text-text">
              <option value="popular">Popular</option>
              <option value="newest">Newest</option>
              <option value="rating">Rating</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex">
          {/* Items */}
          <div className={`overflow-y-auto p-5 ${selected ? "w-1/2 border-r border-border" : "w-full"}`}>
            {loading ? (
              <div className="text-text-muted text-[11px] py-8 text-center">Loading...</div>
            ) : items.length === 0 ? (
              <div className="text-text-muted text-[11px] py-8 text-center">
                {total === 0 ? "No items yet. Click 'Seed Presets' to load templates." : "No items match filters"}
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id}
                    className={`flex items-center gap-3 p-3 bg-surface-dim rounded-lg cursor-pointer transition-colors hover:bg-surface-dim/80 ${selected?.id === item.id ? "ring-1 ring-accent" : ""}`}
                    onClick={() => selectItem(item)}>
                    <span className="text-2xl">{item.icon || TYPE_ICONS[item.type] || "📦"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-text">{item.name}</span>
                        <span className="text-[9px] text-text-muted">v{item.version}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-text-muted">
                        <span>{TYPE_ICONS[item.type] || "📦"} {item.type}</span>
                        {item.category && <span>• {item.category}</span>}
                        {item.authorName && <span>• {item.authorName}</span>}
                        <span>• {renderStars(item.rating)}</span>
                      </div>
                      {item.description && <div className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{item.description}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-text-muted">{item.installCount} installs</span>
                      <button onClick={(e) => { e.stopPropagation(); handleInstall(item.id); }}
                        className="px-2.5 py-1 bg-accent text-white text-[10px] rounded-lg hover:bg-accent/90">Install</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {total > 20 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 bg-surface-dim border border-border rounded-lg text-[11px] text-text disabled:opacity-40">Prev</button>
                <span className="text-[10px] text-text-muted">Page {page + 1} of {Math.ceil(total / 20)}</span>
                <button disabled={(page + 1) * 20 >= total} onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 bg-surface-dim border border-border rounded-lg text-[11px] text-text disabled:opacity-40">Next</button>
              </div>
            )}
          </div>

          {/* Detail */}
          {selected && (
            <div className="w-1/2 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selected.icon || TYPE_ICONS[selected.type] || "📦"}</span>
                <div>
                  <h2 className="text-[15px] font-bold text-text">{selected.name}</h2>
                  <div className="text-[11px] text-text-muted">
                    {selected.type} • v{selected.version} • {selected.authorName || "Anonymous"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-text-muted">{renderStars(selected.rating)} ({selected.reviewCount})</span>
                <span className="text-text-muted">{selected.installCount} installations</span>
                <button onClick={() => handleInstall(selected.id)} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90 ml-auto">Install</button>
              </div>

              {selected.description && (
                <p className="text-[12px] text-text">{selected.description}</p>
              )}
              {selected.longDescription && (
                <p className="text-[11px] text-text-muted">{selected.longDescription}</p>
              )}

              {(selected.tags && selected.tags !== "[]") && (
                <div className="flex flex-wrap gap-1">
                  {JSON.parse(selected.tags).map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 bg-surface rounded text-[9px] text-text-muted">#{tag}</span>
                  ))}
                </div>
              )}

              {/* Reviews */}
              <div>
                <h3 className="text-[12px] font-bold text-text mb-2">Reviews ({selected.reviews?.length || 0})</h3>

                <div className="p-3 bg-surface-dim rounded-lg space-y-2 mb-3">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setReviewForm((p) => ({ ...p, rating: n }))}
                        className={`text-lg ${n <= reviewForm.rating ? "text-yellow-400" : "text-border"}`}>★</button>
                    ))}
                  </div>
                  <textarea value={reviewForm.comment} onChange={(e) => setReviewForm((p) => ({ ...p, comment: e.target.value }))} placeholder="Write a review..." rows={2}
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                  <button onClick={handleReview} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">Submit</button>
                </div>

                {selected.reviews && selected.reviews.length > 0 && (
                  <div className="space-y-2">
                    {selected.reviews.map((review) => (
                      <div key={review.id} className="p-2.5 bg-surface-dim rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400 text-[11px]">{renderStars(review.rating)}</span>
                          <span className="text-[9px] text-text-muted">{new Date(review.createdAt).toLocaleDateString()}</span>
                        </div>
                        {review.comment && <p className="text-[11px] text-text mt-1">{review.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
