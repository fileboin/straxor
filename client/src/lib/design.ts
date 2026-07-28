import { api } from "./api.js";

export interface ImageProviderInfo {
  id: string;
  name: string;
  enabled: boolean;
}

export interface ImageGenerationRequest {
  prompt: string;
  provider: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  style?: string;
  model?: string;
  negativePrompt?: string;
}

export interface ImageGenerationResult {
  id: string;
  url: string;
  provider: string;
  prompt: string;
  width: number;
  height: number;
  seed: number;
  cost: number;
  durationMs: number;
  createdAt: string;
}

export interface GeneratedWebsite {
  id: string;
  prompt: string;
  html: string;
  css: string;
  js?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
}

export interface GeneratedUIComponent {
  id: string;
  prompt: string;
  name: string;
  framework: string;
  code: string;
  css?: string;
  previewUrl?: string;
  createdAt: string;
}

export interface PresentationSlide {
  title: string;
  content: string;
  notes?: string;
  imagePrompt?: string;
}

export interface GeneratedPresentation {
  id: string;
  prompt: string;
  title: string;
  slides: PresentationSlide[];
  html: string;
  theme: string;
  createdAt: string;
}

export interface DesignSystem {
  id: string;
  prompt: string;
  name: string;
  tokens: DesignSystemToken[];
  css: string;
  previewHtml: string;
  createdAt: string;
}

export interface DesignSystemToken {
  category: string;
  name: string;
  value: string;
  cssVar: string;
  description?: string;
}

export interface MediaItem {
  id: string;
  name: string;
  type: string;
  mime: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  alt?: string;
  tags: string[];
  folder: string;
  provider?: string;
  prompt?: string;
  createdAt: string;
}

export interface DesignGenerationRequest {
  prompt: string;
  type: "website" | "ui" | "image" | "presentation" | "design-system";
  provider?: string;
  style?: string;
  layout?: string;
  pages?: string[];
}

// ── API ──

export async function getDesignProviders(): Promise<ImageProviderInfo[]> {
  return api("/design/providers");
}

export async function generateDesign(req: DesignGenerationRequest): Promise<any> {
  return api("/design/generate", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
  return api("/design/generate-image", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function generateWebsite(prompt: string, style?: string): Promise<GeneratedWebsite> {
  return api("/design/generate-website", {
    method: "POST",
    body: JSON.stringify({ prompt, style }),
  });
}

export async function generateUIComponent(prompt: string, style?: string): Promise<GeneratedUIComponent> {
  return api("/design/generate-ui", {
    method: "POST",
    body: JSON.stringify({ prompt, style }),
  });
}

export async function generatePresentation(prompt: string, style?: string): Promise<GeneratedPresentation> {
  return api("/design/generate-presentation", {
    method: "POST",
    body: JSON.stringify({ prompt, style }),
  });
}

export async function generateDesignSystem(prompt: string): Promise<DesignSystem> {
  return api("/design/generate-design-system", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

// Media Library

export async function listMedia(folder?: string, tags?: string[], type?: string): Promise<MediaItem[]> {
  const params = new URLSearchParams();
  if (folder) params.set("folder", folder);
  if (tags?.length) params.set("tags", tags.join(","));
  if (type) params.set("type", type);
  return api(`/design/media?${params}`);
}

export async function searchMedia(q: string): Promise<MediaItem[]> {
  return api(`/design/media/search?q=${encodeURIComponent(q)}`);
}

export async function deleteMedia(id: string): Promise<{ deleted: boolean }> {
  return api(`/design/media/${id}`, { method: "DELETE" });
}

export async function getMediaStats(): Promise<{ total: number; byType: Record<string, number>; totalSize: number }> {
  return api("/design/media/stats");
}

export async function listWebsites(): Promise<GeneratedWebsite[]> {
  return api("/design/websites");
}

export async function listUIComponents(): Promise<GeneratedUIComponent[]> {
  return api("/design/ui-components");
}
