import type { ImageStyle } from "./types.js";

const BUILTIN_STYLES: ImageStyle[] = [
  {
    id: "corporate", name: "Corporate", category: "business",
    description: "Clean corporate visuals with professional tone, blue/white palette, sharp lines.",
    visualTraits: ["clean", "professional", "sharp", "minimal"],
    colorPalette: ["#1E3A5F", "#FFFFFF", "#4A90D9", "#2C3E50"],
    promptPrefix: "Professional corporate style, clean design, business-appropriate,",
    promptSuffix: "corporate branding, professional atmosphere.",
    negativePrompt: "casual, grunge, messy, cartoon, sketch",
    isBuiltin: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "minimal", name: "Minimal", category: "design",
    description: "Minimalist aesthetic with plenty of whitespace and simple geometric elements.",
    visualTraits: ["minimal", "clean", "geometric", "whitespace"],
    colorPalette: ["#000000", "#FFFFFF", "#F5F5F5", "#CCCCCC"],
    promptPrefix: "Minimalist design, simple, clean, plenty of negative space,",
    promptSuffix: "minimal aesthetic, less is more.",
    negativePrompt: "busy, cluttered, detailed, ornate, complex",
    isBuiltin: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "modern", name: "Modern", category: "design",
    description: "Contemporary design with gradients, shadows, and sleek typography.",
    visualTraits: ["contemporary", "sleek", "gradient", "shadow"],
    colorPalette: ["#6C63FF", "#FF6584", "#2D3436", "#DFE6E9"],
    promptPrefix: "Modern design, contemporary style, sleek,",
    promptSuffix: "modern aesthetic, trendy.",
    negativePrompt: "vintage, retro, old-fashioned, classic",
    isBuiltin: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "dark", name: "Dark", category: "theme",
    description: "Dark mode optimized with vibrant accents on deep backgrounds.",
    visualTraits: ["dark", "vibrant", "neon", "high-contrast"],
    colorPalette: ["#0D1117", "#1F2937", "#58A6FF", "#3FB950"],
    promptPrefix: "Dark theme, dark background, vibrant accent colors,",
    promptSuffix: "dark mode optimized, high contrast.",
    negativePrompt: "light background, bright, washed out, pastel",
    isBuiltin: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "cyberpunk", name: "Cyberpunk", category: "theme",
    description: "Neon-drenched futuristic aesthetic with high contrast and glitch effects.",
    visualTraits: ["neon", "futuristic", "glitch", "high-contrast"],
    colorPalette: ["#FF00FF", "#00FFFF", "#FFFF00", "#0D0221"],
    promptPrefix: "Cyberpunk style, neon-lit, futuristic cityscape,",
    promptSuffix: "cyberpunk aesthetic, neon glow, rainy streets.",
    negativePrompt: "rural, nature, daylight, clean, organized",
    isBuiltin: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "glass", name: "Glass", category: "design",
    description: "Glassmorphism style with frosted glass effects and soft shadows.",
    visualTraits: ["glass", "frosted", "translucent", "soft-shadow"],
    colorPalette: ["rgba(255,255,255,0.3)", "rgba(255,255,255,0.1)", "#FFFFFF", "#E0E0E0"],
    promptPrefix: "Glassmorphism design, frosted glass effect, translucent surfaces, soft shadows,",
    promptSuffix: "glass aesthetic, modern UI.",
    negativePrompt: "solid, opaque, flat, matte",
    isBuiltin: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "developer", name: "Developer", category: "theme",
    description: "Code-friendly dark theme with syntax highlighting colors.",
    visualTraits: ["code", "terminal", "dark", "syntax-colored"],
    colorPalette: ["#1E1E1E", "#569CD6", "#6A9955", "#DCDCAA"],
    promptPrefix: "Developer theme, code editor style, terminal aesthetic,",
    promptSuffix: "programming theme, syntax highlighting.",
    negativePrompt: "bright, colorful, artistic, paint",
    isBuiltin: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "startup", name: "Startup", category: "business",
    description: "Modern startup aesthetic with vibrant gradients and bold typography.",
    visualTraits: ["vibrant", "bold", "gradient", "energetic"],
    colorPalette: ["#FF6B35", "#004E89", "#FFD700", "#1A1A2E"],
    promptPrefix: "Startup brand style, vibrant, energetic, bold,",
    promptSuffix: "startup aesthetic, modern tech company.",
    negativePrompt: "corporate, traditional, formal, dull",
    isBuiltin: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];

export class StyleEngine {
  private styles = new Map<string, ImageStyle>();

  constructor() {
    for (const style of BUILTIN_STYLES) {
      this.styles.set(style.id, style);
    }
  }

  register(style: ImageStyle): void {
    this.styles.set(style.id, style);
  }

  get(id: string): ImageStyle | undefined {
    return this.styles.get(id);
  }

  delete(id: string): void {
    if (this.getBuiltinIds().includes(id)) return;
    this.styles.delete(id);
  }

  list(category?: string): ImageStyle[] {
    const all = Array.from(this.styles.values());
    if (category) return all.filter(s => s.category === category);
    return all;
  }

  listCategories(): string[] {
    const cats = new Set(Array.from(this.styles.values()).map(s => s.category));
    return Array.from(cats).sort();
  }

  getBuiltinIds(): string[] {
    return BUILTIN_STYLES.map(s => s.id);
  }

  applyStyle(prompt: string, styleId: string): { prompt: string; negativePrompt?: string } {
    const style = this.styles.get(styleId);
    if (!style) return { prompt };

    let enhanced = prompt;
    if (style.promptPrefix) enhanced = `${style.promptPrefix} ${enhanced}`;
    if (style.promptSuffix) enhanced = `${enhanced} ${style.promptSuffix}`;

    return { prompt: enhanced, negativePrompt: style.negativePrompt };
  }
}
