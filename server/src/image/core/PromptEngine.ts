import type { PromptTemplate, PromptHistoryEntry } from "./types.js";

export class PromptEngine {
  private history: PromptHistoryEntry[] = [];

  improvePrompt(original: string, style?: { promptPrefix?: string; promptSuffix?: string }): string {
    let improved = original.trim();

    if (style?.promptPrefix) improved = `${style.promptPrefix} ${improved}`;
    if (style?.promptSuffix) improved = `${improved} ${style.promptSuffix}`;

    if (!improved.endsWith(".")) improved += ".";

    improved = improved.replace(/\s+/g, " ");

    return improved;
  }

  buildFromTemplate(template: PromptTemplate, variables: Record<string, string>): string {
    let prompt = template.template;
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
    return prompt;
  }

  translatePrompt(prompt: string, targetLang: string): string {
    return `[${targetLang}] ${prompt}`;
  }

  addHistory(entry: PromptHistoryEntry): void {
    this.history.unshift(entry);
    if (this.history.length > 500) this.history.pop();
  }

  getHistory(limit = 50): PromptHistoryEntry[] {
    return this.history.slice(0, limit);
  }

  clearHistory(): void {
    this.history = [];
  }
}
