import { api } from "./api.js";

// ── Types ──

export type AssetCategory =
  | "svg"
  | "lucide"
  | "heroicons"
  | "bettershot"
  | "brand"
  | "images"
  | "templates"
  | "presentation";

export type AssetFormat = "svg" | "png" | "jpg" | "webp" | "figma" | "mdx" | "json";

export interface DesignAsset {
  id: string;
  name: string;
  category: AssetCategory;
  format: AssetFormat;
  tags: string[];
  description: string;
  content?: string;
  url?: string;
  previewUrl?: string;
  width?: number;
  height?: number;
  license?: string;
  source?: string;
  createdAt: string;
}

export interface AssetCollection {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: AssetCategory;
  assetCount: number;
  source: string;
  url: string;
  version?: string;
  isInstalled: boolean;
}

export interface DesignToken {
  id: string;
  name: string;
  category: "color" | "spacing" | "typography" | "shadow" | "radius" | "animation";
  value: string;
  cssVar?: string;
  tailwindClass?: string;
  description?: string;
}

export interface DesignAssetStats {
  totalIcons: number;
  totalTokens: number;
  totalCollections: number;
  installedCollections: number;
  totalAssets: number;
  categories: string[];
  tokenCategories: string[];
}

// ── Labels ──

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  svg: "SVG Ikone",
  lucide: "Lucide",
  heroicons: "Heroicons",
  bettershot: "BetterShot",
  brand: "Brand Assets",
  images: "Slike",
  templates: "Šabloni",
  presentation: "Prezentacije",
};

export const CATEGORY_ICONS: Record<AssetCategory, string> = {
  svg: "◆",
  lucide: "◈",
  heroicons: "▲",
  bettershot: "📸",
  brand: "⚡",
  images: "🖼",
  templates: "📋",
  presentation: "📊",
};

export const TOKEN_CATEGORY_LABELS: Record<string, string> = {
  color: "Boje",
  spacing: "Razmaci",
  typography: "Tipografija",
  shadow: "Sjenke",
  radius: "Border Radius",
  animation: "Animacije",
};

// ── API ──

export async function listCollections(): Promise<AssetCollection[]> {
  return api("/design-assets/collections");
}

export async function listIcons(category?: string, search?: string): Promise<DesignAsset[]> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (search) params.set("search", search);
  const qs = params.toString();
  return api(`/design-assets/icons${qs ? `?${qs}` : ""}`);
}

export async function listTokens(category?: string): Promise<DesignToken[]> {
  const params = category ? `?category=${category}` : "";
  return api(`/design-assets/tokens${params}`);
}

export async function getStats(): Promise<DesignAssetStats> {
  return api("/design-assets/stats");
}
