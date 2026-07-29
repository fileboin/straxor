import type { ImageProviderAdapter } from "./interfaces.js";
import type { ImageGenerationRequest, ImageGenerationResult, ImageFormat } from "../core/types.js";

interface QwenResponse {
  output?: { task_id?: string; task_status?: string; results?: { url: string }[] };
}

export class QwenImageAdapter implements ImageProviderAdapter {
  name = "qwen-image";
  displayName = "Qwen Image";
  supportedFormats: ImageFormat[] = ["png", "jpeg", "webp"];
  maxDimensions = { width: 1024, height: 1024 };

  private apiKey?: string;
  private baseUrl: string;

  constructor(config?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = config?.apiKey || process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
    this.baseUrl = config?.baseUrl || "https://dashscope.aliyuncs.com/api/v1";
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult[]> {
    const start = Date.now();
    const body = {
      model: "qwen-vl-plus",
      input: { prompt: request.prompt },
      parameters: {
        size: `${request.width || 1024}x${request.height || 1024}`,
        n: request.numImages || 1,
        seed: request.seed,
      },
    };

    const res = await fetch(`${this.baseUrl}/services/aigc/text-generation/generation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Qwen Image generation failed: ${res.status} ${err}`);
    }

    const data = (await res.json()) as QwenResponse;
    const duration = Date.now() - start;

    return (data.output?.results ?? []).map((r, i) => ({
      id: `qwen-${data.output?.task_id ?? Date.now()}-${i}`,
      url: r.url,
      width: request.width || 1024,
      height: request.height || 1024,
      format: (request.format || "png") as ImageFormat,
      provider: this.name,
      model: "qwen-vl-plus",
      duration,
      cost: this.estimateCost(request),
      seed: request.seed,
      createdAt: new Date().toISOString(),
    }));
  }

  estimateCost(_request: ImageGenerationRequest): number {
    return 0.008;
  }

  estimateDuration(_request: ImageGenerationRequest): number {
    return 6000;
  }
}
