import type { ImageProviderAdapter } from "./interfaces.js";
import type { ImageGenerationRequest, ImageGenerationResult, ImageFormat } from "../core/types.js";

interface ComfyUIResponse {
  prompt_id: string;
  number: number;
  node_errors?: Record<string, unknown>;
}

interface ComfyUIHistory {
  [promptId: string]: {
    outputs: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }>;
    status: { completed: boolean };
  };
}

export class ComfyUIAdapter implements ImageProviderAdapter {
  name = "comfy-ui";
  displayName = "ComfyUI";
  supportedFormats: ImageFormat[] = ["png"];
  maxDimensions = { width: 2048, height: 2048 };

  private baseUrl: string;

  constructor(config?: { baseUrl?: string }) {
    this.baseUrl = config?.baseUrl || process.env.COMFYUI_URL || "http://127.0.0.1:8188";
  }

  isAvailable(): boolean {
    return true;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult[]> {
    const start = Date.now();
    const workflow = this.buildWorkflow(request);

    const queueRes = await fetch(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!queueRes.ok) {
      const err = await queueRes.text();
      throw new Error(`ComfyUI queue failed: ${queueRes.status} ${err}`);
    }

    const { prompt_id } = (await queueRes.json()) as ComfyUIResponse;
    const history = await this.pollHistory(prompt_id);
    const duration = Date.now() - start;
    const results: ImageGenerationResult[] = [];

    for (const nodeId of Object.keys(history.outputs)) {
      const nodeOutput = history.outputs[nodeId];
      if (nodeOutput.images) {
        for (const img of nodeOutput.images) {
          const viewUrl = `${this.baseUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`;
          results.push({
            id: `comfy-${prompt_id}-${results.length}`,
            url: viewUrl,
            width: request.width || 1024,
            height: request.height || 1024,
            format: "png" as ImageFormat,
            provider: this.name,
            duration,
            cost: this.estimateCost(request),
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    return results;
  }

  private buildWorkflow(request: ImageGenerationRequest): Record<string, unknown> {
    return {
      "3": {
        class_type: "KSampler",
        inputs: {
          seed: request.seed ?? Math.floor(Math.random() * 2 ** 32),
          steps: request.quality === "draft" ? 20 : request.quality === "hd" ? 50 : 30,
          cfg: 7,
          sampler_name: "euler",
          scheduler: "normal",
          denoise: 1,
          model: ["4", 0],
          positive: ["6", 0],
          negative: ["7", 0],
          latent_image: ["5", 0],
        },
      },
      "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "sd_xl_base_1.0.safetensors" } },
      "5": { class_type: "EmptyLatentImage", inputs: { width: request.width || 1024, height: request.height || 1024, batch_size: request.numImages || 1 } },
      "6": { class_type: "CLIPTextEncode", inputs: { text: request.prompt, clip: ["4", 1] } },
      "7": { class_type: "CLIPTextEncode", inputs: { text: request.negativePrompt || "", clip: ["4", 1] } },
      "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
      "9": { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: "straxor" } },
    };
  }

  private async pollHistory(promptId: string, maxRetries = 60): Promise<{ outputs: ComfyUIHistory[string]["outputs"] }> {
    for (let i = 0; i < maxRetries; i++) {
      const res = await fetch(`${this.baseUrl}/history/${promptId}`);
      const data = (await res.json()) as ComfyUIHistory;
      if (data[promptId]) {
        if (data[promptId].status.completed) return data[promptId];
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error("ComfyUI generation timed out");
  }

  estimateCost(_request: ImageGenerationRequest): number {
    return 0;
  }

  estimateDuration(_request: ImageGenerationRequest): number {
    return 15000;
  }
}
