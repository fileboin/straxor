export interface AIStreamEvent {
  type: "token" | "error";
  content: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
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
