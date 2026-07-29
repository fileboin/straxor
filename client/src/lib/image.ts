const BASE = "/api/image";
const PROJECT_HEADER = "x-project-id";

function headers(projectId?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (projectId) h[PROJECT_HEADER] = projectId;
  return h;
}

async function api<T>(path: string, options?: RequestInit, projectId?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(projectId), ...(options?.headers as Record<string, string> || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Image API error");
  }
  return res.json();
}

export interface GenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numImages?: number;
  styleId?: string;
  quality?: "draft" | "standard" | "hd";
  format?: string;
  seed?: number;
  provider?: string;
  projectId?: string;
  tags?: string[];
  assetType?: string;
}

export interface GenerationResult {
  id: string;
  url: string;
  b64?: string;
  width: number;
  height: number;
  format: string;
  provider: string;
  model?: string;
  duration: number;
  cost: number;
  seed?: number;
  createdAt: string;
}

export interface ImageRecord {
  id: string;
  projectId?: string;
  url: string;
  width: number;
  height: number;
  format: string;
  size: number;
  provider: string;
  model?: string;
  prompt: string;
  negativePrompt?: string;
  styleId?: string;
  tags: string[];
  assetType?: string;
  version: number;
  cost: number;
  duration: number;
  quality: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImageStyle {
  id: string;
  name: string;
  category: string;
  description: string;
  visualTraits: string[];
  colorPalette?: string[];
  promptPrefix?: string;
  promptSuffix?: string;
  negativePrompt?: string;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  template: string;
  variables: string[];
  tags: string[];
  createdAt: string;
}

export interface BrandIdentity {
  id: string;
  projectId: string;
  name: string;
  colorPalette: { name: string; hex: string; role: string }[];
  typography: { headingFont?: string; bodyFont?: string; weights?: number[] };
  iconStyle: string;
  visualIdentity: string;
  assets: { type: string; url: string; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface ProviderInfo {
  name: string;
  displayName: string;
  supportedFormats: string[];
  maxDimensions: { width: number; height: number };
  available: boolean;
  isEnabled: boolean;
  priority: number;
  costPerImage: number;
}

export interface CostOverview {
  records: { id: string; provider: string; totalCost: number; totalDuration: number; createdAt: string }[];
  total: number;
  byProvider: Record<string, number>;
}

export interface QualityResult {
  imageId: string;
  resolution: { width: number; height: number };
  resolutionPass: boolean;
  score: number;
  passed: boolean;
  issues: string[];
}

export interface OptimizationResult {
  id: string;
  imageId: string;
  url: string;
  width: number;
  height: number;
  format: string;
  size: number;
  compressionRatio?: number;
}

export interface AssetSpec {
  type: string;
  width: number;
  height: number;
  format: string;
  description: string;
}

// Generation
export const generateImage = (req: GenerationRequest): Promise<GenerationResult[]> =>
  api("/generate", { method: "POST", body: JSON.stringify(req) }, req.projectId);

export const generateAsset = (type: string, subject: string, projectId?: string, brand?: string): Promise<GenerationResult[]> =>
  api("/generate/asset", { method: "POST", body: JSON.stringify({ type, subject, projectId, brand }) }, projectId);

// Images
export const listImages = (projectId?: string, tags?: string, assetType?: string): Promise<ImageRecord[]> => {
  const params = new URLSearchParams();
  if (projectId) params.set("projectId", projectId);
  if (tags) params.set("tags", tags);
  if (assetType) params.set("assetType", assetType);
  return api(`/images?${params.toString()}`);
};

export const getImage = (id: string): Promise<ImageRecord> =>
  api(`/images/${id}`);

export const deleteImage = (id: string): Promise<{ success: boolean }> =>
  api(`/images/${id}`, { method: "DELETE" });

export const updateImage = (id: string, updates: Partial<ImageRecord>): Promise<ImageRecord> =>
  api(`/images/${id}`, { method: "PATCH", body: JSON.stringify(updates) });

export const searchImages = (q: string, projectId?: string): Promise<ImageRecord[]> =>
  api(`/images/search?q=${encodeURIComponent(q)}&projectId=${projectId || ""}`);

// Styles
export const listStyles = (category?: string): Promise<ImageStyle[]> =>
  api(`/styles?category=${category || ""}`);

export const createStyle = (style: Partial<ImageStyle>): Promise<ImageStyle> =>
  api("/styles", { method: "POST", body: JSON.stringify(style) });

export const deleteStyle = (id: string): Promise<{ success: boolean }> =>
  api(`/styles/${id}`, { method: "DELETE" });

// Templates
export const listTemplates = (category?: string): Promise<PromptTemplate[]> =>
  api(`/templates?category=${category || ""}`);

export const createTemplate = (tpl: Partial<PromptTemplate>): Promise<PromptTemplate> =>
  api("/templates", { method: "POST", body: JSON.stringify(tpl) });

export const deleteTemplate = (id: string): Promise<{ success: boolean }> =>
  api(`/templates/${id}`, { method: "DELETE" });

// Branding
export const createBrand = (projectId: string, name: string): Promise<BrandIdentity> =>
  api("/branding", { method: "POST", body: JSON.stringify({ projectId, name }) }, projectId);

export const getBrand = (projectId: string): Promise<BrandIdentity> =>
  api(`/branding/${projectId}`, undefined, projectId);

export const updateBrand = (projectId: string, updates: Partial<BrandIdentity>): Promise<BrandIdentity> =>
  api(`/branding/${projectId}`, { method: "PUT", body: JSON.stringify(updates) }, projectId);

export const deleteBrand = (projectId: string): Promise<{ success: boolean }> =>
  api(`/branding/${projectId}`, { method: "DELETE" }, projectId);

// Costs
export const getCosts = (projectId?: string): Promise<CostOverview> =>
  api(`/costs?projectId=${projectId || ""}`);

export const setBudget = (projectId: string, maxCost: number): Promise<{ success: boolean }> =>
  api("/costs/budget", { method: "POST", body: JSON.stringify({ projectId, maxCost }) }, projectId);

// Providers
export const listProviders = (): Promise<ProviderInfo[]> =>
  api("/providers");

export const updateProvider = (name: string, config: Partial<ProviderInfo>): Promise<{ success: boolean }> =>
  api(`/providers/${name}`, { method: "PUT", body: JSON.stringify(config) });

// Strategy
export const setStrategy = (strategy: string): Promise<{ success: boolean; strategy: string }> =>
  api("/strategy", { method: "POST", body: JSON.stringify({ strategy }) });

// Quality
export const checkQuality = (imageId: string, expectedAspectRatio?: number): Promise<QualityResult> =>
  api(`/quality/${imageId}`, { method: "POST", body: JSON.stringify({ expectedAspectRatio }) });

// Optimization
export const optimizeImage = (req: {
  imageId: string;
  targetWidth?: number;
  targetHeight?: number;
  targetFormat?: string;
  quality?: number;
  compress?: boolean;
  upscale?: boolean;
  crop?: { x: number; y: number; width: number; height: number };
}): Promise<OptimizationResult> =>
  api("/optimize", { method: "POST", body: JSON.stringify(req) });

export const getOptimizations = (imageId: string): Promise<OptimizationResult[]> =>
  api(`/optimize/${imageId}`);

// Assets
export const listAssetSpecs = (): Promise<AssetSpec[]> =>
  api("/asset-specs");
