import type { PromptTemplate } from "./types.js";

const BUILTIN_TEMPLATES: PromptTemplate[] = [
  {
    id: "product-shot",
    name: "Product Shot",
    category: "product",
    template: "Professional product photography of {subject}. Clean background, studio lighting, high detail, {style}.",
    variables: ["subject", "style"],
    tags: ["product", "professional", "studio"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "hero-banner",
    name: "Hero Banner",
    category: "marketing",
    template: "Wide hero banner for {brand}. {subject} centered, {mood} atmosphere, cinematic lighting, text space on {side} side, 1200x400 composition.",
    variables: ["brand", "subject", "mood", "side"],
    tags: ["banner", "hero", "marketing"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "app-screenshot",
    name: "App Screenshot",
    category: "ui",
    template: "Mobile app screenshot of {app_name}. {screen_description}. Modern UI, clean design, {platform} design language, realistic phone frame.",
    variables: ["app_name", "screen_description", "platform"],
    tags: ["app", "screenshot", "mobile", "ui"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "logo-design",
    name: "Logo Design",
    category: "branding",
    template: "Minimalist logo for {brand_name}, {industry} industry. {style} style, clean lines, scalable vector design, {color_scheme} color scheme, transparent background.",
    variables: ["brand_name", "industry", "style", "color_scheme"],
    tags: ["logo", "branding", "minimal"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "social-post",
    name: "Social Media Post",
    category: "marketing",
    template: "Social media post for {platform}. {message}. {style} visual style, {size} format, engaging composition, text overlay ready.",
    variables: ["platform", "message", "style", "size"],
    tags: ["social", "marketing", "post"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "blog-cover",
    name: "Blog Cover",
    category: "content",
    template: "Blog post cover image about {topic}. {mood} atmosphere, {style} illustration style, space for title text, wide format, professional.",
    variables: ["topic", "mood", "style"],
    tags: ["blog", "cover", "content"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "github-repo",
    name: "GitHub Repository Cover",
    category: "development",
    template: "GitHub repository cover for {repo_name}. {tech_stack} themed, dark mode friendly, {style} design, repository banner style 1280x640.",
    variables: ["repo_name", "tech_stack", "style"],
    tags: ["github", "repository", "cover", "development"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "presentation-slide",
    name: "Presentation Slide",
    category: "business",
    template: "Presentation slide for {topic}. {style} design, professional layout, {company} branding, clear hierarchy, 1920x1080.",
    variables: ["topic", "style", "company"],
    tags: ["presentation", "slide", "business"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export class TemplateEngine {
  private templates = new Map<string, PromptTemplate>();

  constructor() {
    for (const tpl of BUILTIN_TEMPLATES) {
      this.templates.set(tpl.id, tpl);
    }
  }

  register(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  get(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  delete(id: string): void {
    this.templates.delete(id);
  }

  list(category?: string): PromptTemplate[] {
    const all = Array.from(this.templates.values());
    if (category) return all.filter(t => t.category === category);
    return all;
  }

  listCategories(): string[] {
    const categories = new Set(Array.from(this.templates.values()).map(t => t.category));
    return Array.from(categories).sort();
  }

  getBuiltinIds(): string[] {
    return BUILTIN_TEMPLATES.map(t => t.id);
  }
}
