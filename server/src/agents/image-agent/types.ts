export type DomainMode =
  | "product-visual" | "illustration" | "pixel-art" | "ui-design"
  | "photography" | "logo-design" | "3d-render" | "character-design"
  | "architecture" | "banana-nature" | "comic-book" | "cinematic"
  | "steampunk" | "cyberpunk" | "watercolor" | "anime"
  | "isometric" | "technical-drawing" | "fantasy" | "map"
  | "macro-food";

export const DOMAIN_MODE_VALUES: DomainMode[] = [
  "product-visual", "illustration", "pixel-art", "ui-design",
  "photography", "logo-design", "3d-render", "character-design",
  "architecture", "banana-nature", "comic-book", "cinematic",
  "steampunk", "cyberpunk", "watercolor", "anime",
  "isometric", "technical-drawing", "fantasy", "map",
  "macro-food",
];

export interface PromptComponents {
  subject: string;
  action: string;
  location: string;
  composition: string;
  style: string;
}

export interface BrandPreset {
  id: string;
  name: string;
  description: string;
  colors: string[];
  styleKeywords: string[];
  visualTraits: string[];
  icon: string;
}

export interface DomainModeConfig {
  id: DomainMode;
  name: string;
  description: string;
  icon: string;
  recommendedModel: string;
  defaultResolution: string;
  defaultAspectRatio: string;
  stylePrefix: string;
  styleSuffix: string;
  visualTraits: string[];
}

export interface ImageAgentSession {
  id: string;
  projectId: string;
  title: string;
  messages: ImageAgentMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ImageAgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
  promptComponents?: PromptComponents;
  domainMode?: DomainMode;
  imageResults?: ImageAgentImageResult[];
  promptText?: string;
  createdAt: number;
}

export interface ImageAgentImageResult {
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
  variationIndex?: number;
}

export interface ImageAgentRequest {
  prompt: string;
  domainMode?: DomainMode;
  brandPresetId?: string;
  aspectRatio?: string;
  resolution?: string;
  model?: string;
  n?: number;
  sessionId?: string;
  projectId: string;
}

export interface ImageAgentGenerateResponse {
  message: ImageAgentMessage;
  session: ImageAgentSession;
}

export const VALID_ASPECT_RATIOS = [
  "1:1", "16:9", "9:16", "4:3", "3:4",
  "2:3", "3:2", "4:5", "5:4", "1:4",
  "4:1", "1:8", "8:1", "21:9",
] as const;

export const VALID_RESOLUTIONS = ["512", "1K", "2K", "4K"] as const;
