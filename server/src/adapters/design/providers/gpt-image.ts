import { BaseImageProvider } from "../image-provider.js";
import type { ImageProviderId, ImageGenerationRequest, ImageGenerationResult } from "../types.js";

export class GPTImageProvider extends BaseImageProvider {
  id: ImageProviderId = "gpt-image";
  name = "GPT Image (DALL-E)";

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const start = Date.now();
    const { width, height } = this.validateDimensions(req);
    const seed = req.seed ?? Math.floor(Math.random() * 2147483647);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        id: this.makeId(),
        url: `https://placehold.co/${width}x${height}/0e1422/ff4d2e?text=DALL-E+${encodeURIComponent(req.prompt.slice(0, 30))}`,
        provider: "gpt-image",
        prompt: req.prompt,
        width,
        height,
        seed,
        cost: 0,
        durationMs: Date.now() - start,
        createdAt: new Date().toISOString(),
      };
    }

    const size = `${width}x${height}` as "1024x1024" | "1792x1024" | "1024x1792";
    const model = req.model || "dall-e-3";

    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: req.prompt,
        n: 1,
        size,
        quality: req.style === "hd" ? "hd" : "standard",
      }),
    });
    const data: any = await resp.json();
    const url = data?.data?.[0]?.url || `https://placehold.co/${width}x${height}/0e1422/ff4d2e?text=DALL-E`;

    return {
      id: this.makeId(),
      url,
      provider: "gpt-image",
      prompt: req.prompt,
      width,
      height,
      seed,
      cost: model === "dall-e-3" ? 0.04 : 0.02,
      durationMs: Date.now() - start,
      createdAt: new Date().toISOString(),
    };
  }
}
