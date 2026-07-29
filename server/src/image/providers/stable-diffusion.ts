import type { ImageProviderAdapter } from "./interfaces.js";
import type { ImageGenerationRequest, ImageGenerationResult, ImageFormat } from "../core/types.js";

interface SDApiResponse {
  images?: string[];
  parameters?: Record<string, unknown>;
  info?: string;
}

export class StableDiffusionAdapter implements ImageProviderAdapter {
  name = "stable-diffusion";
  displayName = "Stable Diffusion";
  supportedFormats: ImageFormat[] = ["png", "jpeg", "webp"];
  maxDimensions = { width: 2048, height: 2048 };

  private baseUrl: string;
  private apiKey?: string;

  constructor(config?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = config?.apiKey || process.env.STABLE_DIFFUSION_API_KEY;
    this.baseUrl = config?.baseUrl || process.env.STABLE_DIFFUSION_URL || "http://127.0.0.1:7860";
  }

  isAvailable(): boolean {
    return true;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult[]> {
    const start = Date.now();
    const body = {
      prompt: request.prompt,
      negative_prompt: request.negativePrompt || "",
      width: request.width || 512,
      height: request.height || 512,
      batch_size: request.numImages || 1,
      seed: request.seed ?? -1,
      steps: request.quality === "draft" ? 20 : request.quality === "hd" ? 50 : 30,
      save_images: false,
      send_images: true,
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.baseUrl}/sdapi/v1/txt2img`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Stable Diffusion generation failed: ${res.status} ${err}`);
    }

    const data = (await res.json()) as SDApiResponse;
    const duration = Date.now() - start;

    return (data.images ?? []).map((b64, i) => ({
      id: `sd-${Date.now()}-${i}`,
      url: `data:image/png;base64,${b64}`,
      b64,
      width: request.width || 512,
      height: request.height || 512,
      format: "png" as ImageFormat,
      provider: this.name,
      duration,
      cost: this.estimateCost(request),
      seed: request.seed,
      createdAt: new Date().toISOString(),
    }));
  }

  estimateCost(_request: ImageGenerationRequest): number {
    return 0;
  }

  estimateDuration(_request: ImageGenerationRequest): number {
    return 5000;
  }
}
