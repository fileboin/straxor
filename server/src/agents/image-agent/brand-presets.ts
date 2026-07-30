import type { BrandPreset } from "./types.js";

const PRESETS: BrandPreset[] = [
  {
    id: "corporate-blue",
    name: "Corporate Blue",
    description: "Trustworthy, professional blue palette for enterprise brands",
    colors: ["#1a56db", "#3b82f6", "#60a5fa", "#1e3a5f", "#f0f4ff"],
    styleKeywords: ["professional", "corporate", "clean", "modern", "trustworthy"],
    visualTraits: ["clean lines", "minimal", "professional", "structured", "formal"],
    icon: "🏢",
  },
  {
    id: "startup-vibrant",
    name: "Startup Vibrant",
    description: "Bold, energetic colors for modern startups",
    colors: ["#7c3aed", "#ec4899", "#f59e0b", "#10b981", "#fff"],
    styleKeywords: ["vibrant", "energetic", "modern", "bold", "innovative"],
    visualTraits: ["bold colors", "gradient", "modern", "dynamic", "playful"],
    icon: "🚀",
  },
  {
    id: "minimal-dark",
    name: "Minimal Dark",
    description: "Elegant dark theme with accent highlights",
    colors: ["#0f172a", "#1e293b", "#38bdf8", "#94a3b8", "#ffffff"],
    styleKeywords: ["minimal", "dark", "elegant", "sophisticated", "modern"],
    visualTraits: ["dark mode", "high contrast", "minimal", "elegant", "clean"],
    icon: "🌙",
  },
  {
    id: "nature-green",
    name: "Nature Green",
    description: "Organic, earthy palette for eco-conscious brands",
    colors: ["#065f46", "#059669", "#34d399", "#a7f3d0", "#fefce8"],
    styleKeywords: ["natural", "organic", "eco-friendly", "fresh", "sustainable"],
    visualTraits: ["earthy", "organic", "fresh", "natural", "eco-friendly"],
    icon: "🌿",
  },
  {
    id: "luxury-gold",
    name: "Luxury Gold",
    description: "Premium gold and deep burgundy for high-end brands",
    colors: ["#d4a853", "#fbbf24", "#7c2d12", "#1c1917", "#faf5eb"],
    styleKeywords: ["luxury", "premium", "elegant", "sophisticated", "exclusive"],
    visualTraits: ["gold accents", "rich colors", "elegant", "sophisticated", "premium"],
    icon: "👑",
  },
  {
    id: "tech-neon",
    name: "Tech Neon",
    description: "Cyberpunk-inspired neon palette for tech brands",
    colors: ["#0a0a1a", "#00f0ff", "#ff00ff", "#7b2ff7", "#00ff88"],
    styleKeywords: ["tech", "neon", "cyberpunk", "futuristic", "digital"],
    visualTraits: ["neon glow", "dark background", "futuristic", "tech", "digital"],
    icon: "💻",
  },
  {
    id: "playful-pastel",
    name: "Playful Pastel",
    description: "Soft, friendly pastel colors for creative and kid-friendly brands",
    colors: ["#fbcfe8", "#bfdbfe", "#cbd5e1", "#fde68a", "#ffffff"],
    styleKeywords: ["playful", "friendly", "soft", "creative", "colorful"],
    visualTraits: ["pastel", "soft", "playful", "friendly", "cheerful"],
    icon: "🌈",
  },
  {
    id: "editorial-serif",
    name: "Editorial Serif",
    description: "Classic, print-inspired palette with serif typography",
    colors: ["#292524", "#57534e", "#d6d3d1", "#f5f5f4", "#ffffff"],
    styleKeywords: ["editorial", "classic", "serif", "print", "sophisticated"],
    visualTraits: ["serif", "classic", "print quality", "editorial", "timeless"],
    icon: "📰",
  },
  {
    id: "sunset-warm",
    name: "Sunset Warm",
    description: "Warm sunset-inspired palette for hospitality and lifestyle",
    colors: ["#fd7e14", "#f87171", "#fb923c", "#fde68a", "#fff7ed"],
    styleKeywords: ["warm", "sunset", "hospitality", "welcoming", "cozy"],
    visualTraits: ["warm tones", "sunset colors", "welcoming", "cozy", "organic"],
    icon: "🌅",
  },
  {
    id: "ocean-deep",
    name: "Ocean Deep",
    description: "Deep ocean blues with teal accents for marine themes",
    colors: ["#0c4a6e", "#0891b2", "#22d3ee", "#0284c7", "#f0f9ff"],
    styleKeywords: ["ocean", "deep", "calm", "trustworthy", "refreshing"],
    visualTraits: ["ocean blues", "teal accents", "calm", "deep", "refreshing"],
    icon: "🌊",
  },
];

export function getBrandPreset(id: string): BrandPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function listBrandPresets(): BrandPreset[] {
  return PRESETS;
}
