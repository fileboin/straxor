import type { PackageListing, PackageManifest, PackageVersion, SearchQuery, SearchResult, Review, CreatorProfile, PackageCategory } from "../../../server/src/marketplace/core/types.js";

const BASE = "/api/marketplace-core";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Stats ──
export function getStats() {
  return fetchJSON<{ totalPackages: number; totalDownloads: number; totalInstalls: number; totalCreators: number; totalReviews: number; averageRating: number }>(`${BASE}/stats`);
}

// ── List ──
export function listPackages(category?: PackageCategory, limit = 50, offset = 0) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (category) params.set("category", category);
  return fetchJSON<{ listings: PackageListing[]; total: number }>(`${BASE}/packages?${params}`);
}

// ── Search ──
export function searchPackages(query: SearchQuery) {
  const params = new URLSearchParams({ q: query.query, limit: String(query.limit ?? 50), offset: String(query.offset ?? 0) });
  if (query.category) params.set("category", query.category);
  if (query.tags) params.set("tags", query.tags.join(","));
  if (query.license) params.set("license", query.license);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortOrder) params.set("sortOrder", query.sortOrder);
  if (query.minScore !== undefined) params.set("minScore", String(query.minScore));
  return fetchJSON<SearchResult>(`${BASE}/search?${params}`);
}

export function semanticSearch(q: string, category?: PackageCategory, limit = 10) {
  const params = new URLSearchParams({ q, limit: String(limit) });
  if (category) params.set("category", category);
  return fetchJSON<{ listings: PackageListing[] }>(`${BASE}/semantic-search?${params}`);
}

// ── Recommendations ──
export function getRecommendations(type?: string, limit = 10) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (type) params.set("type", type);
  return fetchJSON<{ trending?: PackageListing[]; popular?: PackageListing[]; newReleases?: PackageListing[]; listings?: PackageListing[] }>(`${BASE}/recommendations?${params}`);
}

// ── Package CRUD ──
export function getPackage(name: string) {
  return fetchJSON<PackageListing>(`${BASE}/packages/${encodeURIComponent(name)}`);
}

export function publishPackage(manifest: PackageManifest, version: PackageVersion) {
  return fetchJSON<PackageListing>(`${BASE}/packages`, { method: "POST", body: JSON.stringify({ manifest, version }) });
}

export function updatePackage(name: string, manifest: PackageManifest, version: PackageVersion) {
  return fetchJSON<PackageListing>(`${BASE}/packages/${encodeURIComponent(name)}`, { method: "PUT", body: JSON.stringify({ manifest, version }) });
}

export function deletePackage(name: string) {
  return fetchJSON<{ success: boolean }>(`${BASE}/packages/${encodeURIComponent(name)}`, { method: "DELETE" });
}

export function deprecatePackage(name: string, reason?: string) {
  return fetchJSON<{ success: boolean }>(`${BASE}/packages/${encodeURIComponent(name)}/deprecate`, { method: "POST", body: JSON.stringify({ reason }) });
}

export function archivePackage(name: string) {
  return fetchJSON<{ success: boolean }>(`${BASE}/packages/${encodeURIComponent(name)}/archive`, { method: "POST" });
}

// ── Verify ──
export function verifyPackage(name: string) {
  return fetchJSON<any>(`${BASE}/packages/${encodeURIComponent(name)}/verify`, { method: "POST" });
}

// ── Versions ──
export function getVersions(name: string) {
  return fetchJSON<{ versions: PackageVersion[] }>(`${BASE}/packages/${encodeURIComponent(name)}/versions`);
}

export function getVersion(name: string, version: string) {
  return fetchJSON<PackageVersion>(`${BASE}/packages/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`);
}

// ── Dependencies ──
export function resolveDependencies(name: string, version: string) {
  return fetchJSON<any>(`${BASE}/packages/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}/dependencies`);
}

export function checkCompatibility(name: string, version: string) {
  return fetchJSON<any>(`${BASE}/packages/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}/compatibility`);
}

// ── Reviews ──
export function getReviews(name: string, limit = 20, offset = 0) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return fetchJSON<{ reviews: Review[]; total: number; distribution: Record<number, number>; averageRating: number }>(`${BASE}/packages/${encodeURIComponent(name)}/reviews?${params}`);
}

export function addReview(name: string, userId: string, userName: string, rating: number, content: string, title?: string) {
  return fetchJSON<Review>(`${BASE}/packages/${encodeURIComponent(name)}/reviews`, { method: "POST", body: JSON.stringify({ userId, userName, rating, content, title }) });
}

export function updateReview(name: string, reviewId: string, userId: string, rating?: number, content?: string, title?: string) {
  return fetchJSON<Review>(`${BASE}/packages/${encodeURIComponent(name)}/reviews/${reviewId}`, { method: "PUT", body: JSON.stringify({ userId, rating, content, title }) });
}

export function deleteReview(name: string, reviewId: string, userId: string) {
  return fetchJSON<{ success: boolean }>(`${BASE}/packages/${encodeURIComponent(name)}/reviews/${reviewId}`, { method: "DELETE", body: JSON.stringify({ userId }) });
}

// ── Creators ──
export function registerCreator(data: { userId: string; name: string; displayName?: string; bio?: string }) {
  return fetchJSON<CreatorProfile>(`${BASE}/creators`, { method: "POST", body: JSON.stringify(data) });
}

export function getCreator(userId: string) {
  return fetchJSON<CreatorProfile>(`${BASE}/creators/${encodeURIComponent(userId)}`);
}

export function getCreatorAnalytics(userId: string) {
  return fetchJSON<any>(`${BASE}/creators/${encodeURIComponent(userId)}/analytics`);
}

// ── Related ──
export function getRelatedPackages(name: string) {
  return fetchJSON<{ listings: PackageListing[] }>(`${BASE}/packages/${encodeURIComponent(name)}/related`);
}

// ── Categories / Licenses ──
export function getCategories() {
  return fetchJSON<{ categories: Array<{ id: string; name: string; count: number }> }>(`${BASE}/categories`);
}

export function getLicenses() {
  return fetchJSON<{ licenses: any[] }>(`${BASE}/licenses`);
}
