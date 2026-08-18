import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  listPackages, searchPackages, getPackage, getRecommendations,
  getCategories, getReviews, getVersions, getRelatedPackages,
  publishPackage, verifyPackage,
} from "../lib/marketplace-core";
import type { PackageListing, Review, PackageCategory, PackageManifest, PackageVersion } from "../../../server/src/marketplace/core/types.js";
import { ALL_CATEGORIES, CATEGORY_DISPLAY } from "../../../server/src/marketplace/core/types.js";

type Tab = "browse" | "category" | "detail" | "publish" | "creator" | "search";

export default function Marketplace() {
  const { category: categoryParam } = useParams();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>("browse");
  const [listings, setListings] = useState<PackageListing[]>([]);
  const [selected, setSelected] = useState<PackageListing | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [versions, setVersions] = useState<PackageVersion[]>([]);
  const [related, setRelated] = useState<PackageListing[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [trending, setTrending] = useState<PackageListing[]>([]);
  const [popular, setPopular] = useState<PackageListing[]>([]);
  const [newReleases, setNewReleases] = useState<PackageListing[]>([]);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState<PackageCategory | undefined>(
    categoryParam as PackageCategory
  );

  // Publish form state
  const [pName, setPName] = useState("");
  const [pDisplayName, setPDisplayName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pCategory, setPCategory] = useState<PackageCategory>("plugin");
  const [pVersion, setPVersion] = useState("1.0.0");
  const [pTags, setPTags] = useState("");
  const [pLicense, setPLicense] = useState("mit");

  // Category state
  const [catListings, setCatListings] = useState<PackageListing[]>([]);

  const loadHome = useCallback(async () => {
    setLoading(true);
    try {
      const [rec, cats] = await Promise.all([
        getRecommendations(),
        getCategories(),
      ]);
      setTrending(rec.trending ?? []);
      setPopular(rec.popular ?? []);
      setNewReleases(rec.newReleases ?? []);
      setCategories(cats.categories);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { loadHome(); }, [loadHome]);

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await searchPackages({ query: q, limit: 50 });
      setListings(result.listings);
      setTab("search");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const openDetail = async (name: string) => {
    setLoading(true);
    setError("");
    try {
      const [pkg, revs, vers, rel] = await Promise.all([
        getPackage(name),
        getReviews(name),
        getVersions(name),
        getRelatedPackages(name),
      ]);
      setSelected(pkg);
      setReviews(revs.reviews);
      setVersions(vers.versions);
      setRelated(rel.listings);
      setTab("detail");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const openCategory = async (cat: PackageCategory) => {
    setActiveCategory(cat);
    setLoading(true);
    try {
      const result = await listPackages(cat, 100);
      setCatListings(result.listings);
      setTab("category");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const handlePublish = async () => {
    if (!pName || !pDisplayName || !pDesc) { setError("Name, display name, and description required"); return; }
    setLoading(true);
    setError("");
    try {
      const manifest: PackageManifest = {
        name: pName, displayName: pDisplayName, description: pDesc,
        category: pCategory, tags: pTags.split(",").map(t => t.trim()).filter(Boolean),
        author: { id: "user-1", name: "User" },
        license: pLicense as any, visibility: "public",
        dependencies: [], compatibility: {},
        keywords: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      const version: PackageVersion = {
        version: pVersion, changelog: "Initial release",
        manifest, dependencies: [], peerDependencies: [],
        isDeprecated: false, publishedAt: new Date().toISOString(),
      };
      await publishPackage(manifest, version);
      setTab("browse");
      loadHome();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const handleVerify = async (name: string) => {
    setLoading(true);
    try {
      const result = await verifyPackage(name);
      alert(`Verification: ${result.status}\nSecurity: ${result.securityScore}/100\nQuality: ${result.qualityScore}/100\nCompatibility: ${result.compatibilityScore}/100`);
      if (selected) openDetail(name);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="marketplace page">
      <div className="page-header">
        <h1>Marketplace</h1>
        <p className="text-secondary">Discover, share, and install reusable components</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="marketplace-toolbar">
        <div className="search-bar">
          <input
            type="text" placeholder="Search agents, plugins, templates, workflows..."
            value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSearch(query)}
          />
          <button className="btn" onClick={() => doSearch(query)}>Search</button>
        </div>
        <button className="btn btn-primary" onClick={() => { setTab("publish"); setError(""); }}>
          + Publish
        </button>
      </div>

      {tab === "browse" && (
        <div className="marketplace-home">
          <section>
            <h2>Categories</h2>
            <div className="category-grid">
              {categories.map(cat => (
                <button key={cat.id} className="category-card" onClick={() => openCategory(cat.id as PackageCategory)}>
                  <span className="category-name">{cat.name}</span>
                  <span className="category-count">{cat.count} packages</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2>Trending</h2>
            <PackageList listings={trending} onClick={openDetail} />
          </section>

          <section>
            <h2>Popular</h2>
            <PackageList listings={popular} onClick={openDetail} />
          </section>

          <section>
            <h2>New Releases</h2>
            <PackageList listings={newReleases} onClick={openDetail} />
          </section>
        </div>
      )}

      {tab === "category" && (
        <div className="marketplace-category">
          <button className="btn" onClick={() => setTab("browse")}>← Back</button>
          <h2>{activeCategory ? CATEGORY_DISPLAY[activeCategory] : "Category"}</h2>
          <PackageList listings={catListings} onClick={openDetail} />
          {catListings.length === 0 && !loading && <p className="text-secondary">No packages in this category yet.</p>}
        </div>
      )}

      {tab === "search" && (
        <div className="marketplace-search">
          <button className="btn" onClick={() => setTab("browse")}>← Back</button>
          <h2>Search Results</h2>
          <PackageList listings={listings} onClick={openDetail} />
          {listings.length === 0 && !loading && <p className="text-secondary">No results found.</p>}
        </div>
      )}

      {tab === "detail" && selected && (
        <div className="marketplace-detail">
          <button className="btn" onClick={() => setTab("browse")}>← Back to Browse</button>

          <div className="detail-header">
            <div className="detail-info">
              <h2>{selected.manifest.displayName}</h2>
              <p className="text-secondary">{selected.manifest.description}</p>
              <div className="detail-meta">
                <span className="badge">{CATEGORY_DISPLAY[selected.manifest.category]}</span>
                <span>v{selected.latestVersion}</span>
                <span>{selected.manifest.license.toUpperCase()}</span>
                <span>{selected.stats.downloads.toLocaleString()} downloads</span>
                <span>★ {selected.stats.averageRating.toFixed(1)} ({selected.stats.totalReviews})</span>
              </div>
              <div className="detail-tags">
                {selected.manifest.tags.map(t => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
          </div>

          <div className="detail-sections">
            <div className="detail-section">
              <h3>Verification</h3>
              <div className="verification-scores">
                <div className="score-item">
                  <span className="score-label">Overall</span>
                  <span className={`score-value ${selected.verification.overallScore >= 70 ? "score-good" : selected.verification.overallScore >= 40 ? "score-mid" : "score-bad"}`}>
                    {selected.verification.overallScore}/100
                  </span>
                </div>
                <div className="score-item">
                  <span className="score-label">Security</span>
                  <span className="score-value">{selected.verification.securityScore}/100</span>
                </div>
                <div className="score-item">
                  <span className="score-label">Quality</span>
                  <span className="score-value">{selected.verification.qualityScore}/100</span>
                </div>
                <div className="score-item">
                  <span className="score-label">Compatibility</span>
                  <span className="score-value">{selected.verification.compatibilityScore}/100</span>
                </div>
              </div>
              <div className="verification-status">
                Status: <span className={`badge badge-${selected.verification.status}`}>{selected.verification.status}</span>
                {selected.verification.malwareScanResult !== "not-scanned" && (
                  <span> Malware: {selected.verification.malwareScanResult}</span>
                )}
              </div>
              {selected.verification.securityIssues.length > 0 && (
                <div className="detail-issues">
                  <h4>Security Issues</h4>
                  <ul>{selected.verification.securityIssues.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              <button className="btn btn-sm" onClick={() => handleVerify(selected.manifest.name)}>Re-verify</button>
            </div>

            <div className="detail-section">
              <h3>Versions ({versions.length})</h3>
              <div className="version-list">
                {versions.map(v => (
                  <div key={v.version} className={`version-item ${v.isDeprecated ? "deprecated" : ""}`}>
                    <span className="version-number">v{v.version}</span>
                    <span className="version-date">{new Date(v.publishedAt).toLocaleDateString()}</span>
                    {v.isDeprecated && <span className="badge badge-warning">Deprecated</span>}
                    <p className="version-changelog">{v.changelog}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="detail-section">
              <h3>Dependencies</h3>
              {selected.manifest.dependencies.length === 0 ? (
                <p className="text-secondary">No dependencies</p>
              ) : (
                <ul className="dep-list">
                  {selected.manifest.dependencies.map(d => (
                    <li key={d.name}>{d.name} @ {d.version}{d.optional ? " (optional)" : ""}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="detail-section">
              <h3>Compatibility</h3>
              {selected.manifest.compatibility.straxorVersion && <p>STRAXOR: {selected.manifest.compatibility.straxorVersion}</p>}
              {selected.manifest.compatibility.nodeVersion && <p>Node: {selected.manifest.compatibility.nodeVersion}</p>}
              {selected.manifest.compatibility.platforms && <p>Platforms: {selected.manifest.compatibility.platforms.join(", ")}</p>}
              {!selected.manifest.compatibility.straxorVersion && !selected.manifest.compatibility.nodeVersion && (
                <p className="text-secondary">No compatibility info</p>
              )}
            </div>

            <div className="detail-section">
              <h3>Reviews ({reviews.length})</h3>
              <div className="review-list">
                {reviews.map(r => (
                  <div key={r.id} className="review-card">
                    <div className="review-header">
                      <strong>{r.userName}</strong>
                      <span className="review-rating">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                      <span className="review-date">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    {r.title && <h4>{r.title}</h4>}
                    <p>{r.content}</p>
                  </div>
                ))}
                {reviews.length === 0 && <p className="text-secondary">No reviews yet.</p>}
              </div>
            </div>

            <div className="detail-section">
              <h3>Related Packages</h3>
              <PackageList listings={related} onClick={openDetail} />
            </div>
          </div>
        </div>
      )}

      {tab === "publish" && (
        <div className="marketplace-publish">
          <button className="btn" onClick={() => setTab("browse")}>← Cancel</button>
          <h2>Publish Package</h2>
          <div className="publish-form">
            <div className="form-group">
              <label>Package Name *</label>
              <input type="text" value={pName} onChange={e => setPName(e.target.value)} placeholder="e.g. my-awesome-plugin" />
            </div>
            <div className="form-group">
              <label>Display Name *</label>
              <input type="text" value={pDisplayName} onChange={e => setPDisplayName(e.target.value)} placeholder="My Awesome Plugin" />
            </div>
            <div className="form-group">
              <label>Description *</label>
              <textarea value={pDesc} onChange={e => setPDesc(e.target.value)} placeholder="Describe what your package does..." rows={3} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select value={pCategory} onChange={e => setPCategory(e.target.value as PackageCategory)}>
                  {ALL_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_DISPLAY[c]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Version</label>
                <input type="text" value={pVersion} onChange={e => setPVersion(e.target.value)} />
              </div>
              <div className="form-group">
                <label>License</label>
                <select value={pLicense} onChange={e => setPLicense(e.target.value)}>
                  <option value="mit">MIT</option>
                  <option value="apache-2.0">Apache 2.0</option>
                  <option value="gpl-3.0">GPL 3.0</option>
                  <option value="bsd-3-clause">BSD 3-Clause</option>
                  <option value="commercial">Commercial</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Tags (comma-separated)</label>
              <input type="text" value={pTags} onChange={e => setPTags(e.target.value)} placeholder="react, vite, typescript" />
            </div>
            <button className="btn btn-primary" onClick={handlePublish} disabled={loading}>
              {loading ? "Publishing..." : "Publish Package"}
            </button>
          </div>
        </div>
      )}

      {loading && <div className="loading-spinner" />}
    </div>
  );
}

function PackageList({ listings, onClick }: { listings: PackageListing[]; onClick: (name: string) => void }) {
  if (listings.length === 0) return null;
  return (
    <div className="package-grid">
      {listings.map(pkg => (
        <div key={pkg.id} className="package-card" onClick={() => onClick(pkg.manifest.name)}>
          <div className="package-card-header">
            <h3>{pkg.manifest.displayName}</h3>
            <span className="badge">{CATEGORY_DISPLAY[pkg.manifest.category]}</span>
          </div>
          <p className="package-card-desc">{pkg.manifest.description}</p>
          <div className="package-card-meta">
            <span>v{pkg.latestVersion}</span>
            <span>{pkg.stats.downloads.toLocaleString()} downloads</span>
            <span>★ {pkg.stats.averageRating.toFixed(1)}</span>
          </div>
          <div className="package-card-tags">
            {pkg.manifest.tags.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}
          </div>
          <div className="package-card-verify">
            <span className={`badge badge-${pkg.verification.status}`}>{pkg.verification.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
