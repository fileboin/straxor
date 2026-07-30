import type { PromptComponents, DomainModeConfig } from "./types.js";

const DEFAULT_COMPONENTS: PromptComponents = {
  subject: "",
  action: "",
  location: "",
  composition: "",
  style: "",
};

function extractComponents(raw: string): PromptComponents {
  const c: PromptComponents = { ...DEFAULT_COMPONENTS };

  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const lower = line.toLowerCase();

    if (lower.startsWith("subject:") || lower.startsWith("subject-")) {
      c.subject = line.split(":")[1]?.trim() || "";
    } else if (lower.startsWith("action:") || lower.startsWith("action-")) {
      c.action = line.split(":")[1]?.trim() || "";
    } else if (lower.startsWith("location:") || lower.startsWith("location-") || lower.startsWith("setting:")) {
      c.location = line.split(":")[1]?.trim() || "";
    } else if (lower.startsWith("composition:") || lower.startsWith("comp:")) {
      c.composition = line.split(":")[1]?.trim() || "";
    } else if (lower.startsWith("style:")) {
      c.style = line.split(":")[1]?.trim() || "";
    }
  }

  if (!c.subject && !c.action && !c.location && !c.composition && !c.style) {
    const words = raw.split(/[,.;!?]+/).map((w) => w.trim()).filter(Boolean);
    if (words.length >= 1) c.subject = words[0];
    if (words.length >= 2) c.action = words.slice(1).join(", ");
  }

  return c;
}

export class PromptEngine {
  decompose(raw: string): PromptComponents {
    return extractComponents(raw);
  }

  buildPrompt(components: PromptComponents, mode?: DomainModeConfig): string {
    const parts: string[] = [];

    if (components.subject) parts.push(components.subject);
    if (components.action) parts.push(components.action);
    if (components.location) parts.push(`in ${components.location}`);

    if (mode) {
      if (mode.stylePrefix) parts.unshift(mode.stylePrefix.trim());
      if (mode.styleSuffix) parts.push(mode.styleSuffix.trim());
    }

    if (components.composition) parts.push(components.composition);
    if (components.style) parts.push(components.style);

    return parts.join(", ");
  }

  applyBrandKeywords(prompt: string, keywords: string[]): string {
    if (keywords.length === 0) return prompt;
    return `${keywords.join(", ")}, ${prompt}`;
  }

  generateVariations(basePrompt: string, count: number): string[] {
    const variations: string[] = [basePrompt];
    const styleVariations = [
      "cinematic lighting",
      "soft natural lighting",
      "dramatic shadows",
      "bright and airy",
      "moody atmosphere",
      "golden hour glow",
      "studio lighting",
    ];

    for (let i = 1; i < count; i++) {
      const mod = styleVariations[i % styleVariations.length];
      variations.push(`${basePrompt}, ${mod}, variation ${i + 1}`);
    }

    return variations.slice(0, count);
  }
}
