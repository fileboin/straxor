import type { ImageProviderAdapter } from "./interfaces.js";
import type { ImageGenerationRequest, ImageGenerationResult, ImageFormat } from "../core/types.js";

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { inlineData?: { mimeType: string; data: string }; text?: string }[];
    };
  }[];
}

export class GeminiImageAdapter implements ImageProviderAdapter {
  name = "gemini-image";
  displayName = "Gemini Image";
  supportedFormats: ImageFormat[] = ["png", "jpeg", "webp"];
  maxDimensions = { width: 2048, height: 2048 };

  private apiKey?: string;
  private baseUrl: string;
  private model: string;

  constructor(config?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = config?.apiKey || process.env.GEMINI_API_KEY;
    this.baseUrl = config?.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
    this.model = config?.model || "gemini-2.0-flash-exp-image-generation";
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult[]> {
    const start = Date.now();
    const parts: Record<string, unknown>[] = [{ text: request.prompt }];
    if (request.negativePrompt) {
      parts.push({ text: `Avoid: ${request.negativePrompt}` });
    }

    const body = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["image", "text"],
        ...(request.seed ? { seed: request.seed } : {}),
      },
    };

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini Image generation failed: ${res.status} ${err}`);
    }

    const data = (await res.json()) as GeminiResponse;
    const duration = Date.now() - start;
    const results: ImageGenerationResult[] = [];

    if (data.candidates) {
      for (const candidate of data.candidates) {
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              results.push({
                id: `gemini-${Date.now()}-${results.length}`,
                url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                b64: part.inlineData.data,
                width: request.width || 1024,
                height: request.height || 1024,
                format: (part.inlineData.mimeType.includes("png") ? "png" : "webp") as ImageFormat,
                provider: this.name,
                model: this.model,
                duration,
                cost: this.estimateCost(request),
                createdAt: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    return results;
  }

  estimateCost(_request: ImageGenerationRequest): number {
    return 0;
  }

  estimateDuration(_request: ImageGenerationRequest): number {
    return 4000;
  }
}
