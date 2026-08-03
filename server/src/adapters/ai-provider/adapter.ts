import type { ContentBlock } from "../../lib/attachments.js";

export interface AIStreamEvent {
  type: "token" | "error";
  content: string;
}

export type ChatContent = string | ContentBlock[];

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: ChatContent;
}

export interface AIProviderAdapter {
  streamChat(params: {
    providerId: string;
    modelId: string;
    messages: ChatMessage[];
    apiKey: string;
    thinking?: string;
  }): AsyncGenerator<AIStreamEvent, void, unknown>;
}
