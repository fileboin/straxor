export interface ContextSource {
  type: "rules" | "memory" | "files" | "web" | "system" | "search";
  label: string;
  content: string;
  tokenCount: number;
  priority: number;
}

export interface AssembledContext {
  sources: ContextSource[];
  totalTokens: number;
  truncated: boolean;
  systemPrompt: string;
  summary: string;
}

export interface ContextEngine {
  // Assemble full context for a prompt
  assemble(params: {
    prompt: string;
    rules: { name: string; content: string; category: string }[];
    memories: { key: string; content: string; category: string }[];
    relevantFiles?: { path: string; content: string }[];
    webResults?: { url: string; title: string; content: string }[];
    searchResults?: { path: string; content: string; score: number }[];
    systemPrompt?: string;
    maxTokens?: number;
  }): Promise<AssembledContext>;

  // Count tokens in text
  countTokens(text: string): number;

  // Summarize text to fit within token limit
  summarize(text: string, maxTokens: number): Promise<string>;

  // Find relevant files for a prompt (keyword matching)
  findRelevantFiles(prompt: string, files: { path: string; content: string }[], maxFiles?: number): { path: string; content: string; score: number }[];
}
