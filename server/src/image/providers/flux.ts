import type { ImageProviderAdapter } from "./interfaces.js";
import type { ImageGenerationRequest, ImageGenerationResult, ImageFormat } from "../core/types.js";

interface ReplicateResponse {
  id: string;
  status: string;
  output?: string[];
  error?: string;
}

export class FluxAdapter implements ImageProviderAdapter {
  name = "flux";
  displayName = "FLUX";
  supportedFormats: ImageFormat[] = ["png", "jpeg", "webp"];
  maxDimensions = { width: 1440, height: 1440 };

  private apiKey?: string;
  private baseUrl: string;
  private model: string;

  constructor(config?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = config?.apiKey || process.env.REPLICATE_API_TOKEN || process.env.FLUX_API_KEY;
    this.baseUrl = config?.baseUrl || "https://api.replicate.com/v1";
    this.model = config?.model || "black-forest-labs/flux-dev";
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult[]> {
    const start = Date.now();
    const body = {
      version: this.model,
      input: {
        prompt: request.prompt,
        negative_prompt: request.negativePrompt,
        width: request.width || 1024,
        height: request.height || 1024,
        num_outputs: request.numImages || 1,
        num_inference_steps: request.quality === "draft" ? 20 : request.quality === "hd" ? 50 : 30,
        seed: request.seed,
        format: request.format || "png",
      },
    };

    const res = await fetch(`${this.baseUrl}/predictions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`FLUX generation failed: ${res.status} ${err}`);
    }

    const prediction = (await res.json()) as ReplicateResponse;
    const result = await this.pollPrediction(prediction.id);
    const duration = Date.now() - start;

    return (result.output ?? []).map((url, i) => ({
      id: `${prediction.id}-${i}`,
      url,
      width: request.width || 1024,
      height: request.height || 1024,
      format: (request.format || "png") as ImageFormat,
      provider: this.name,
      model: this.model,
      duration,
      cost: this.estimateCost(request),
      seed: request.seed,
      createdAt: new Date().toISOString(),
    }));
  }

  private async pollPrediction(id: string, maxRetries = 30): Promise<ReplicateResponse> {
    for (let i = 0; i < maxRetries; i++) {
      const res = await fetch(`${this.baseUrl}/predictions/${id}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      const data = (await res.json()) as ReplicateResponse;
      if (data.status === "succeeded") return data;
      if (data.status === "failed") throw new Error(`FLUX prediction failed: ${data.error}`);
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error("FLUX prediction timed out");
  }

  estimateCost(_request: ImageGenerationRequest): number {
    return 0.005;
  }

  estimateDuration(_request: ImageGenerationRequest): number {
    return 8000;
  }
}
