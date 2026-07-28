import type { DesignSystem, DesignSystemToken } from "./types.js";

export class DesignSystemGenerator {
  async generate(prompt: string): Promise<DesignSystem> {
    const tokens = this.generateTokens(prompt);
    return {
      id: `ds_${Date.now()}`,
      prompt,
      name: this.extractName(prompt),
      tokens,
      css: this.buildCSS(tokens),
      previewHtml: this.buildPreview(tokens),
      createdAt: new Date().toISOString(),
    };
  }

  private extractName(prompt: string): string {
    return prompt
      .split(" ")
      .slice(0, 3)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") + " Design System";
  }

  private generateTokens(prompt: string): DesignSystemToken[] {
    const q = prompt.toLowerCase();

    const accent = this.extractColor(prompt, ["accent", "primary"]) || "#6b8c42";
    const bg = this.extractColor(prompt, ["background", "bg", "dark"]) || "#000000";
    const surface = this.lighten(bg, 0.04);
    const text = this.isDark(bg) ? "#fafafa" : "#0a0a0a";
    const muted = this.isDark(bg) ? "#737373" : "#a3a3a3";
    const border = this.isDark(bg) ? "#262626" : "#e5e5e5";

    const isMinimal = q.includes("minimal");
    const isRounded = q.includes("rounded") || q.includes("soft");
    const isSharp = q.includes("sharp") || q.includes("bold");

    return [
      { category: "color", name: "Accent", value: accent, cssVar: "--ds-accent", description: "Primary accent color" },
      { category: "color", name: "Background", value: bg, cssVar: "--ds-bg", description: "Main background" },
      { category: "color", name: "Surface", value: surface, cssVar: "--ds-surface", description: "Card surface" },
      { category: "color", name: "Text", value: text, cssVar: "--ds-text", description: "Primary text" },
      { category: "color", name: "Text Muted", value: muted, cssVar: "--ds-text-muted", description: "Secondary text" },
      { category: "color", name: "Border", value: border, cssVar: "--ds-border", description: "Border color" },
      { category: "spacing", name: "XS", value: isMinimal ? "2px" : "4px", cssVar: "--ds-space-xs" },
      { category: "spacing", name: "SM", value: isMinimal ? "4px" : "8px", cssVar: "--ds-space-sm" },
      { category: "spacing", name: "MD", value: isMinimal ? "8px" : "16px", cssVar: "--ds-space-md" },
      { category: "spacing", name: "LG", value: isMinimal ? "16px" : "24px", cssVar: "--ds-space-lg" },
      { category: "spacing", name: "XL", value: isMinimal ? "24px" : "32px", cssVar: "--ds-space-xl" },
      { category: "typography", name: "Sans", value: "system-ui, -apple-system, sans-serif", cssVar: "--ds-font-sans" },
      { category: "typography", name: "Mono", value: "ui-monospace, monospace", cssVar: "--ds-font-mono" },
      { category: "radius", name: "SM", value: isSharp ? "0px" : isRounded ? "8px" : "4px", cssVar: "--ds-radius-sm" },
      { category: "radius", name: "MD", value: isSharp ? "0px" : isRounded ? "12px" : "8px", cssVar: "--ds-radius-md" },
      { category: "radius", name: "LG", value: isSharp ? "0px" : isRounded ? "16px" : "12px", cssVar: "--ds-radius-lg" },
      { category: "shadow", name: "SM", value: "0 1px 2px rgba(0,0,0,0.5)", cssVar: "--ds-shadow-sm" },
      { category: "shadow", name: "MD", value: "0 4px 6px rgba(0,0,0,0.4)", cssVar: "--ds-shadow-md" },
      { category: "shadow", name: "LG", value: "0 10px 25px rgba(0,0,0,0.5)", cssVar: "--ds-shadow-lg" },
    ];
  }

  private extractColor(text: string, keywords: string[]): string | null {
    const colorMap: Record<string, string> = {
      olive: "#6b8c42",
      green: "#22c55e",
      emerald: "#10b981",
      teal: "#14b8a6",
      cyan: "#06b6d4",
      blue: "#3b82f6",
      indigo: "#6366f1",
      purple: "#a855f7",
      pink: "#ec4899",
      red: "#ef4444",
      orange: "#f97316",
      yellow: "#eab308",
      amber: "#f59e0b",
      lime: "#84cc16",
      slate: "#64748b",
      gray: "#6b7280",
      neutral: "#737373",
      white: "#ffffff",
      black: "#000000",
    };

    const lower = text.toLowerCase();
    for (const kw of keywords) {
      const idx = lower.indexOf(kw);
      if (idx === -1) continue;
      const after = lower.slice(idx + kw.length).trim();
      for (const [name, hex] of Object.entries(colorMap)) {
        if (after.startsWith(name) || after.includes(name)) return hex;
      }
    }
    return null;
  }

  private lighten(hex: string, amount: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(amount * 255));
    const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(amount * 255));
    const b = Math.min(255, (num & 0xff) + Math.round(amount * 255));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }

  private isDark(hex: string): boolean {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = (num >> 16) & 0xff;
    const g = (num >> 8) & 0xff;
    const b = num & 0xff;
    return r * 0.299 + g * 0.587 + b * 0.114 < 128;
  }

  private buildCSS(tokens: DesignSystemToken[]): string {
    return `:root {\n${tokens.map((t) => `  ${t.cssVar}: ${t.value};`).join("\n")}\n}\n\n` +
      `.ds-card { background: var(--ds-surface); border: 1px solid var(--ds-border); border-radius: var(--ds-radius-md); padding: var(--ds-space-md); }\n` +
      `.ds-btn { background: var(--ds-accent); color: #fff; border: none; border-radius: var(--ds-radius-sm); padding: var(--ds-space-sm) var(--ds-space-md); font-family: var(--ds-font-sans); cursor: pointer; }\n` +
      `.ds-input { background: var(--ds-bg); border: 1px solid var(--ds-border); border-radius: var(--ds-radius-sm); padding: var(--ds-space-sm); color: var(--ds-text); font-family: var(--ds-font-sans); }\n`;
  }

  private buildPreview(tokens: DesignSystemToken[]): string {
    const find = (name: string) => tokens.find((t) => t.name === name);
    const accent = find("Accent")?.value || "#6b8c42";
    const bg = find("Background")?.value || "#000";
    const text = find("Text")?.value || "#fafafa";
    const surface = find("Surface")?.value || "#0a0a0a";
    const border = find("Border")?.value || "#262626";

    return `<!DOCTYPE html>
<html><head><style>
  body { margin: 0; background: ${bg}; color: ${text}; font-family: system-ui; padding: 2rem; }
  .card { background: ${surface}; border: 1px solid ${border}; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; }
  .btn { background: ${accent}; color: #fff; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
  .swatch { height: 2rem; border-radius: 4px; border: 1px solid ${border}; }
</style></head><body>
  <h1>Design System Preview</h1>
  <div class="grid">
    ${tokens.filter((t) => t.category === "color").map((t) => `<div><div class="swatch" style="background:${t.value}"></div><small>${t.name}</small></div>`).join("")}
  </div>
  <div class="card" style="margin-top:2rem">
    <h2>Sample Card</h2>
    <p>This is a preview card using the generated design tokens.</p>
    <button class="btn">Primary Action</button>
    <button class="btn" style="background:transparent;border:1px solid ${border}">Secondary</button>
  </div>
</body></html>`;
  }
}
