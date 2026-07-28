import { BaseImageProvider } from "../image-provider.js";
import type { ImageProviderId, ImageGenerationRequest, ImageGenerationResult } from "../types.js";

export class FluxProvider extends BaseImageProvider {
  id: ImageProviderId = "flux";
  name = "FLUX";

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const start = Date.now();
    const { width, height } = this.validateDimensions(req);
    const seed = req.seed ?? Math.floor(Math.random() * 2147483647);

    const apiKey = process.env.FLUX_API_KEY || process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
      return {
        id: this.makeId(),
        url: `https://placehold.co/${width}x${height}/1a1a1a/6b8c42?text=FLUX+${encodeURIComponent(req.prompt.slice(0, 30))}`,
        provider: "flux",
        prompt: req.prompt,
        width,
        height,
        seed,
        cost: 0,
        durationMs: Date.now() - start,
        createdAt: new Date().toISOString(),
      };
    }

    const resp = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "black-forest-labs/flux-schnell",
        input: { prompt: req.prompt, width, height, num_outputs: 1 },
      }),
    });
    const data: any = await resp.json();
    const outputUrl = data?.output?.[0] || `https://placehold.co/${width}x${height}/1a1a1a/6b8c42?text=FLUX`;

    return {
      id: this.makeId(),
      url: outputUrl,
      provider: "flux",
      prompt: req.prompt,
      width,
      height,
      seed,
      cost: data?.metrics?.total_cost || 0.002,
      durationMs: Date.now() - start,
      createdAt: new Date().toISOString(),
    };
  }
}
