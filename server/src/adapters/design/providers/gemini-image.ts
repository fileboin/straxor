import { BaseImageProvider } from "../image-provider.js";
import type { ImageProviderId, ImageGenerationRequest, ImageGenerationResult } from "../types.js";

export class GeminiImageProvider extends BaseImageProvider {
  id: ImageProviderId = "gemini-image";
  name = "Gemini Image";

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const start = Date.now();
    const { width, height } = this.validateDimensions(req);
    const seed = req.seed ?? Math.floor(Math.random() * 2147483647);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        id: this.makeId(),
        url: `https://placehold.co/${width}x${height}/0e1422/ff4d2e?text=Gemini+${encodeURIComponent(req.prompt.slice(0, 30))}`,
        provider: "gemini-image",
        prompt: req.prompt,
        width,
        height,
        seed,
        cost: 0,
        durationMs: Date.now() - start,
        createdAt: new Date().toISOString(),
      };
    }

    const model = req.model || "gemini-2.0-flash-exp-image-generation";
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: req.prompt }] }],
          generationConfig: { temperature: 1, topK: 32, topP: 1 },
        }),
      }
    );
    const data: any = await resp.json();
    const imageData = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
    const url = imageData
      ? `data:${imageData.mimeType};base64,${imageData.data}`
      : `https://placehold.co/${width}x${height}/0e1422/ff4d2e?text=Gemini`;

    return {
      id: this.makeId(),
      url,
      provider: "gemini-image",
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
