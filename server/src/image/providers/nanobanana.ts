import type { ImageProviderAdapter } from "./interfaces.js";
import type { ImageGenerationRequest, ImageGenerationResult, ImageFormat } from "../core/types.js";

interface NanoBananaResponse {
  id: string;
  output: string[];
  status: string;
  meta?: { seed?: number };
}

export class NanoBananaAdapter implements ImageProviderAdapter {
  name = "nanobanana";
  displayName = "Nano Banana";
  supportedFormats: ImageFormat[] = ["png", "jpeg", "webp"];
  maxDimensions = { width: 1024, height: 1024 };

  private baseUrl: string;
  private apiKey?: string;

  constructor(config?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = config?.apiKey || process.env.NANOBANANA_API_KEY;
    this.baseUrl = config?.baseUrl || process.env.NANOBANANA_URL || "https://api.nanobanana.ai/v1";
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult[]> {
    const start = Date.now();
    const body = {
      prompt: request.prompt,
      negative_prompt: request.negativePrompt,
      width: request.width || 1024,
      height: request.height || 1024,
      num_images: request.numImages || 1,
      seed: request.seed,
      quality: request.quality || "standard",
      format: request.format || "png",
    };

    const res = await fetch(`${this.baseUrl}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Nano Banana generation failed: ${res.status} ${err}`);
    }

    const data = (await res.json()) as NanoBananaResponse;
    const duration = Date.now() - start;

    return data.output.map((url, i) => ({
      id: `${data.id}-${i}`,
      url,
      width: request.width || 1024,
      height: request.height || 1024,
      format: (request.format || "png") as ImageFormat,
      provider: this.name,
      duration,
      cost: this.estimateCost(request),
      seed: data.meta?.seed ?? request.seed,
      createdAt: new Date().toISOString(),
    }));
  }

  estimateCost(_request: ImageGenerationRequest): number {
    return 0.02;
  }

  estimateDuration(_request: ImageGenerationRequest): number {
    return 3000;
  }
}
