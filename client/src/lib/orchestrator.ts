import { api } from "./api.js";

export interface RouteResult {
  difficulty: "simple" | "moderate" | "complex";
  routed: boolean;
  providerId?: string;
  modelId?: string;
  reason?: string;
  availableProviders: string[];
}

// Call the server difficulty router — returns the best model the user has an
// API key for, based on task complexity. Used when Model orkestracija is ON.
export async function routeChat(message: string, thinking?: string): Promise<RouteResult> {
  return api<RouteResult>("/chat/route", {
    method: "POST",
    body: { message, thinking },
  });
}
