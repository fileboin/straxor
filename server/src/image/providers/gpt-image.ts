import type { ImageProviderAdapter } from "./interfaces.js";
import type { ImageGenerationRequest, ImageGenerationResult, ImageFormat } from "../core/types.js";

interface OpenAIResponse {
  data: { url?: string; b64_json?: string; revised_prompt?: string }[];
  created: number;
}

export class GPTImageAdapter implements ImageProviderAdapter {
  name = "gpt-image";
  displayName = "GPT Image";
  supportedFormats: ImageFormat[] = ["png", "webp"];
  maxDimensions = { width: 1792, height: 1792 };

  private apiKey?: string;
  private baseUrl: string;
  private model: string;

  constructor(config?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
    this.baseUrl = config?.baseUrl || "https://api.openai.com/v1";
    this.model = config?.model || "dall-e-3";
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult[]> {
    const start = Date.now();
    const size = this.pickSize(request.width, request.height);

    const body: Record<string, unknown> = {
      model: this.model,
      prompt: request.prompt,
      n: request.numImages || 1,
      size,
      response_format: "url",
    };

    if (request.quality === "hd") body.quality = "hd";

    const res = await fetch(`${this.baseUrl}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GPT Image generation failed: ${res.status} ${err}`);
    }

    const data = (await res.json()) as OpenAIResponse;
    const duration = Date.now() - start;
    const [w, h] = size.split("x").map(Number);

    return data.data.map((item, i) => ({
      id: `gpt-${data.created}-${i}`,
      url: item.url ?? "",
      b64: item.b64_json,
      width: w,
      height: h,
      format: (request.format || "png") as ImageFormat,
      provider: this.name,
      model: this.model,
      duration,
      cost: this.estimateCost(request),
      createdAt: new Date().toISOString(),
    }));
  }

  private pickSize(width?: number, height?: number): string {
    if (this.model === "dall-e-3") {
      if (width && height) {
        if (width === height) return "1024x1024";
        if (width > height) return "1792x1024";
        return "1024x1792";
      }
      return "1024x1024";
    }
    if (width && height) return `${width}x${height}`;
    return "1024x1024";
  }

  estimateCost(request: ImageGenerationRequest): number {
    if (this.model === "dall-e-3") {
      if (request.quality === "hd") return 0.08;
      return 0.04;
    }
    return 0.02;
  }

  estimateDuration(_request: ImageGenerationRequest): number {
    return 5000;
  }

  getModel(): string {
    return this.model;
  }
}
