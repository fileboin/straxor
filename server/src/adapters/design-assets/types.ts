// ── Design Asset Types ──

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
  content?: string; // inline SVG or code
  url?: string; // external URL or CDN path
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

// ── Asset Collection Definitions ──

export const ASSET_COLLECTIONS: AssetCollection[] = [
  {
    id: "lucide",
    name: "Lucide Icons",
    icon: "◆",
    description: "1000+ open-source SVG ikona — clean, consistent, MIT licenca",
    category: "lucide",
    assetCount: 1548,
    source: "Lucide",
    url: "https://lucide.dev",
    version: "0.460.0",
    isInstalled: true,
  },
  {
    id: "heroicons",
    name: "Heroicons",
    icon: "▲",
    description: "Tailwind CSS ikone — outline, solid, mini varijante",
    category: "heroicons",
    assetCount: 298,
    source: "Tailwind Labs",
    url: "https://heroicons.com",
    version: "2.2.0",
    isInstalled: true,
  },
  {
    id: "bettershot",
    name: "BetterShot",
    icon: "📸",
    description: "Screenshot alat za web app mockup-ove i prezentacije",
    category: "bettershot",
    assetCount: 12,
    source: "BetterShot",
    url: "https://bettershot.dev",
    isInstalled: false,
  },
  {
    id: "brand-straxor",
    name: "Straxor Brand",
    icon: "⚡",
    description: "Straxor brand asset-i — logo, boje, tipografija, šabloni",
    category: "brand",
    assetCount: 24,
    source: "Straxor",
    url: "#",
    isInstalled: true,
  },
  {
    id: "undraw",
    name: "unDraw",
    icon: "🎨",
    description: "Besplatne SVG ilustracije — prilagodljive boje",
    category: "svg",
    assetCount: 300,
    source: "unDraw",
    url: "https://undraw.co",
    isInstalled: true,
  },
  {
    id: "hero-images",
    name: "Hero Images",
    icon: "🖼",
    description: "Slike za hero sekcije, landing page-ove, prezentacije",
    category: "images",
    assetCount: 48,
    source: "Mixed",
    url: "#",
    isInstalled: true,
  },
  {
    id: "slide-templates",
    name: "Presentation Templates",
    icon: "📊",
    description: "HTML/CSS šabloni za prezentacije i pitch deck-ove",
    category: "templates",
    assetCount: 8,
    source: "Straxor",
    url: "#",
    isInstalled: true,
  },
  {
    id: "deck-assets",
    name: "Deck Assets",
    icon: "🎯",
    description: "Grafikoni, dijagrami, ikone za prezentacije",
    category: "presentation",
    assetCount: 36,
    source: "Mixed",
    url: "#",
    isInstalled: true,
  },
];

// ── Sample Lucide Icons (curated for Straxor) ──

export const LUCIDE_ICONS_SAMPLE: DesignAsset[] = [
  { id: "luc-home", name: "Home", category: "lucide", format: "svg", tags: ["home", "house", "main"], description: "Home ikona", content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', license: "MIT", source: "Lucide", createdAt: "2024-01-01" },
  { id: "luc-settings", name: "Settings", category: "lucide", format: "svg", tags: ["settings", "gear", "config"], description: "Settings ikona", content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>', license: "MIT", source: "Lucide", createdAt: "2024-01-01" },
  { id: "luc-search", name: "Search", category: "lucide", format: "svg", tags: ["search", "find", "magnify"], description: "Search ikona", content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>', license: "MIT", source: "Lucide", createdAt: "2024-01-01" },
  { id: "luc-user", name: "User", category: "lucide", format: "svg", tags: ["user", "person", "account"], description: "User ikona", content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', license: "MIT", source: "Lucide", createdAt: "2024-01-01" },
  { id: "luc-code", name: "Code", category: "lucide", format: "svg", tags: ["code", "programming", "developer"], description: "Code ikona", content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>', license: "MIT", source: "Lucide", createdAt: "2024-01-01" },
  { id: "luc-terminal", name: "Terminal", category: "lucide", format: "svg", tags: ["terminal", "console", "shell"], description: "Terminal ikona", content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>', license: "MIT", source: "Lucide", createdAt: "2024-01-01" },
  { id: "luc-rocket", name: "Rocket", category: "lucide", format: "svg", tags: ["rocket", "launch", "deploy"], description: "Rocket ikona", content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>', license: "MIT", source: "Lucide", createdAt: "2024-01-01" },
  { id: "luc-shield", name: "Shield", category: "lucide", format: "svg", tags: ["shield", "security", "protect"], description: "Shield ikona", content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>', license: "MIT", source: "Lucide", createdAt: "2024-01-01" },
  { id: "luc-brain", name: "Brain", category: "lucide", format: "svg", tags: ["brain", "ai", "intelligence"], description: "Brain ikona", content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>', license: "MIT", source: "Lucide", createdAt: "2024-01-01" },
  { id: "luc-git-branch", name: "Git Branch", category: "lucide", format: "svg", tags: ["git", "branch", "version"], description: "Git Branch ikona", content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>', license: "MIT", source: "Lucide", createdAt: "2024-01-01" },
  { id: "luc-database", name: "Database", category: "lucide", format: "svg", tags: ["database", "db", "storage"], description: "Database ikona", content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>', license: "MIT", source: "Lucide", createdAt: "2024-01-01" },
  { id: "luc-globe", name: "Globe", category: "lucide", format: "svg", tags: ["globe", "world", "web"], description: "Globe ikona", content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>', license: "MIT", source: "Lucide", createdAt: "2024-01-01" },
  { id: "luc-zap", name: "Zap", category: "lucide", format: "svg", tags: ["zap", "lightning", "energy", "fast"], description: "Zap ikona", content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>', license: "MIT", source: "Lucide", createdAt: "2024-01-01" },
  { id: "luc-layers", name: "Layers", category: "lucide", format: "svg", tags: ["layers", "stack", "overlap"], description: "Layers ikona", content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>', license: "MIT", source: "Lucide", createdAt: "2024-01-01" },
  { id: "luc-palette", name: "Palette", category: "lucide", format: "svg", tags: ["palette", "color", "design"], description: "Palette ikona", content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>', license: "MIT", source: "Lucide", createdAt: "2024-01-01" },
];

// ── Brand Assets ──

export const BRAND_ASSETS: DesignAsset[] = [
  { id: "brand-logo", name: "Straxor Logo", category: "brand", format: "svg", tags: ["logo", "brand", "main"], description: "Glavni Straxor logo", content: '<svg viewBox="0 0 120 32" xmlns="http://www.w3.org/2000/svg"><text x="0" y="24" font-family="system-ui" font-weight="bold" font-size="24" fill="#6b8c42">straxor</text></svg>', license: "Proprietary", source: "Straxor", createdAt: "2024-01-01" },
  { id: "brand-icon", name: "Straxor Icon", category: "brand", format: "svg", tags: ["icon", "brand", "favicon"], description: "Straxor favicon/icon", content: '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="8" fill="#000"/><text x="16" y="22" text-anchor="middle" font-family="system-ui" font-weight="bold" font-size="18" fill="#6b8c42">S</text></svg>', license: "Proprietary", source: "Straxor", createdAt: "2024-01-01" },
  { id: "brand-wordmark", name: "Straxor Wordmark", category: "brand", format: "svg", tags: ["wordmark", "brand", "text"], description: "Straxor tekstualni logo", content: '<svg viewBox="0 0 200 40" xmlns="http://www.w3.org/2000/svg"><text x="0" y="30" font-family="system-ui" font-weight="800" font-size="32" letter-spacing="-1" fill="#ffffff">straxor</text></svg>', license: "Proprietary", source: "Straxor", createdAt: "2024-01-01" },
];

// ── Design Tokens ──

export const DESIGN_TOKENS: DesignToken[] = [
  { id: "color-accent", name: "Accent (Olive)", category: "color", value: "#6b8c42", cssVar: "--color-accent", tailwindClass: "text-accent", description: "Primarna akcent boja" },
  { id: "color-bg", name: "Background", category: "color", value: "#000000", cssVar: "--color-bg", tailwindClass: "bg-bg", description: "OLED true black pozadina" },
  { id: "color-surface", name: "Surface", category: "color", value: "#0a0a0a", cssVar: "--color-surface", tailwindClass: "bg-surface", description: "Površina kartica i panela" },
  { id: "color-text", name: "Text", category: "color", value: "#fafafa", cssVar: "--color-text", tailwindClass: "text-text", description: "Glavni tekst" },
  { id: "color-muted", name: "Text Muted", category: "color", value: "#737373", cssVar: "--color-text-muted", tailwindClass: "text-text-muted", description: "Prigušeni tekst" },
  { id: "color-border", name: "Border", category: "color", value: "#262626", cssVar: "--color-border", tailwindClass: "border-border", description: "Okviri i granice" },
  { id: "color-blue", name: "Blue", category: "color", value: "#3b82f6", cssVar: "--color-accent-blue", tailwindClass: "text-accent-blue", description: "Plava akcent" },
  { id: "color-red", name: "Red", category: "color", value: "#ef4444", cssVar: "--color-accent-red", tailwindClass: "text-accent-red", description: "Crvena greška" },
  { id: "spacing-xs", name: "XS", category: "spacing", value: "4px", tailwindClass: "p-1", description: "Extra mali razmak" },
  { id: "spacing-sm", name: "SM", category: "spacing", value: "8px", tailwindClass: "p-2", description: "Mali razmak" },
  { id: "spacing-md", name: "MD", category: "spacing", value: "12px", tailwindClass: "p-3", description: "Srednji razmak" },
  { id: "spacing-lg", name: "LG", category: "spacing", value: "16px", tailwindClass: "p-4", description: "Veliki razmak" },
  { id: "radius-sm", name: "Radius SM", category: "radius", value: "8px", tailwindClass: "rounded-lg", description: "Mali border radius" },
  { id: "radius-md", name: "Radius MD", category: "radius", value: "12px", tailwindClass: "rounded-xl", description: "Srednji border radius" },
  { id: "radius-lg", name: "Radius LG", category: "radius", value: "16px", tailwindClass: "rounded-2xl", description: "Veliki border radius" },
  { id: "radius-full", name: "Radius Full", category: "radius", value: "9999px", tailwindClass: "rounded-full", description: "Puni border radius" },
  { id: "shadow-sm", name: "Shadow SM", category: "shadow", value: "0 1px 2px rgba(0,0,0,0.5)", tailwindClass: "shadow-sm", description: "Mala sjenka" },
  { id: "shadow-lg", name: "Shadow LG", category: "shadow", value: "0 10px 25px rgba(0,0,0,0.5)", tailwindClass: "shadow-lg", description: "Velika sjenka" },
  { id: "font-sans", name: "Font Sans", category: "typography", value: "system-ui, -apple-system, sans-serif", tailwindClass: "font-sans", description: "Glavni font" },
  { id: "font-mono", name: "Font Mono", category: "typography", value: "ui-monospace, monospace", tailwindClass: "font-mono", description: "Monospace font za kod" },
  { id: "anim-slide-up", name: "Slide Up", category: "animation", value: "slide-up 0.2s ease-out", cssVar: "--anim-slide-up", description: "Animacija pojavljivanja odozdo" },
];

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
