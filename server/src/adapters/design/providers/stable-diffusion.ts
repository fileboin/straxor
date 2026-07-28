import { BaseImageProvider } from "../image-provider.js";
import type { ImageProviderId, ImageGenerationRequest, ImageGenerationResult } from "../types.js";

export class StableDiffusionProvider extends BaseImageProvider {
  id: ImageProviderId = "stable-diffusion";
  name = "Stable Diffusion";

  private get baseUrl() {
    return process.env.STABLE_DIFFUSION_URL || "http://127.0.0.1:7860";
  }

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const start = Date.now();
    const { width, height } = this.validateDimensions(req);
    const seed = req.seed ?? -1;

    try {
      const resp = await fetch(`${this.baseUrl}/sdapi/v1/txt2img`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: req.prompt,
          negative_prompt: req.negativePrompt || "",
          width,
          height,
          steps: req.steps || 20,
          seed,
          cfg_scale: 7,
          sampler_name: "Euler a",
          styles: req.style ? [req.style] : [],
        }),
      });
      const data: any = await resp.json();
      const base64 = data?.images?.[0];
      const url = base64
        ? `data:image/png;base64,${base64}`
        : `https://placehold.co/${width}x${height}/1a1a1a/6b8c42?text=SD`;

      return {
        id: this.makeId(),
        url,
        provider: "stable-diffusion",
        prompt: req.prompt,
        width,
        height,
        seed: data.seed ?? seed,
        cost: 0,
        durationMs: Date.now() - start,
        createdAt: new Date().toISOString(),
      };
    } catch {
      return {
        id: this.makeId(),
        url: `https://placehold.co/${width}x${height}/1a1a1a/6b8c42?text=SD+Error`,
        provider: "stable-diffusion",
        prompt: req.prompt,
        width,
        height,
        seed,
        cost: 0,
        durationMs: Date.now() - start,
        createdAt: new Date().toISOString(),
      };
    }
  }
}
