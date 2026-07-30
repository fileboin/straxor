const BASE = "/api/image-agent";

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

export type DomainMode =
  | "product-visual" | "illustration" | "pixel-art" | "ui-design"
  | "photography" | "logo-design" | "3d-render" | "character-design"
  | "architecture" | "banana-nature" | "comic-book" | "cinematic"
  | "steampunk" | "cyberpunk" | "watercolor" | "anime"
  | "isometric" | "technical-drawing" | "fantasy" | "map"
  | "macro-food";

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

export interface ImageAgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
  promptComponents?: PromptComponents;
  domainMode?: DomainMode;
  imageResults?: ImageAgentImageResult[];
  promptText?: string;
  createdAt: number;
}

export interface ImageAgentSession {
  id: string;
  projectId: string;
  title: string;
  messages: ImageAgentMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ImageAgentGenerateResponse {
  message: ImageAgentMessage;
  session: ImageAgentSession;
}

export const DOMAIN_MODE_VALUES: DomainMode[] = [
  "product-visual", "illustration", "pixel-art", "ui-design",
  "photography", "logo-design", "3d-render", "character-design",
  "architecture", "banana-nature", "comic-book", "cinematic",
  "steampunk", "cyberpunk", "watercolor", "anime",
  "isometric", "technical-drawing", "fantasy", "map",
  "macro-food",
];

export const VALID_ASPECT_RATIOS = [
  "1:1", "16:9", "9:16", "4:3", "3:4",
  "2:3", "3:2", "4:5", "5:4", "1:4",
  "4:1", "1:8", "8:1", "21:9",
] as const;

export const VALID_RESOLUTIONS = ["512", "1K", "2K", "4K"] as const;

export async function generateImageAgent(req: {
  prompt: string;
  domainMode?: DomainMode;
  brandPresetId?: string;
  aspectRatio?: string;
  resolution?: string;
  model?: string;
  n?: number;
  sessionId?: string;
  projectId?: string;
}): Promise<ImageAgentGenerateResponse> {
  const res = await fetch(`${BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to generate");
  }
  return res.json();
}

export async function listSessions(projectId?: string): Promise<ImageAgentSession[]> {
  const params = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const res = await fetch(`${BASE}/sessions${params}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch sessions");
  return res.json();
}

export async function getSession(id: string): Promise<ImageAgentSession> {
  const res = await fetch(`${BASE}/sessions/${encodeURIComponent(id)}`, { credentials: "include" });
  if (!res.ok) throw new Error("Session not found");
  return res.json();
}

export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete session");
}

export async function clearSession(id: string): Promise<ImageAgentSession> {
  const res = await fetch(`${BASE}/sessions/${encodeURIComponent(id)}/clear`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to clear session");
  return res.json();
}

export async function decomposePrompt(prompt: string): Promise<PromptComponents> {
  const res = await fetch(`${BASE}/decompose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error("Failed to decompose prompt");
  return res.json();
}

export async function listDomainModes(): Promise<DomainModeConfig[]> {
  const res = await fetch(`${BASE}/domain-modes`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch domain modes");
  return res.json();
}

export async function listBrandPresets(): Promise<BrandPreset[]> {
  const res = await fetch(`${BASE}/brand-presets`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch brand presets");
  return res.json();
}
