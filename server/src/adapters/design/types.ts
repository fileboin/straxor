// ── Design Domain Types ──

export type ImageProviderId = "flux" | "gpt-image" | "gemini-image" | "comfy-ui" | "stable-diffusion";

export const IMAGE_PROVIDER_LABELS: Record<ImageProviderId, string> = {
  flux: "FLUX",
  "gpt-image": "GPT Image (DALL-E)",
  "gemini-image": "Gemini Image",
  "comfy-ui": "ComfyUI",
  "stable-diffusion": "Stable Diffusion",
};

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  provider: ImageProviderId;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  style?: string;
  model?: string;
}

export interface ImageGenerationResult {
  id: string;
  url: string;
  provider: ImageProviderId;
  prompt: string;
  width: number;
  height: number;
  seed: number;
  cost: number;
  durationMs: number;
  createdAt: string;
}

export interface DesignGenerationRequest {
  prompt: string;
  type: "website" | "ui" | "image" | "presentation" | "design-system";
  provider?: ImageProviderId;
  style?: string;
  layout?: string;
  pages?: string[];
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
  framework: "react" | "vue" | "svelte" | "html";
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

export interface MediaItem {
  id: string;
  name: string;
  type: "image" | "video" | "audio" | "document" | "other";
  mime: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  alt?: string;
  tags: string[];
  folder: string;
  provider?: ImageProviderId;
  prompt?: string;
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
  category: "color" | "spacing" | "typography" | "shadow" | "radius";
  name: string;
  value: string;
  cssVar: string;
  description?: string;
}
