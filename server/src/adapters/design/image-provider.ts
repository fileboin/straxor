import type { ImageProviderId, ImageGenerationRequest, ImageGenerationResult } from "./types.js";

export abstract class BaseImageProvider {
  abstract id: ImageProviderId;
  abstract name: string;

  abstract generate(req: ImageGenerationRequest): Promise<ImageGenerationResult>;

  protected makeId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  protected validateDimensions(req: ImageGenerationRequest) {
    const w = Math.min(Math.max(req.width || 1024, 256), 2048);
    const h = Math.min(Math.max(req.height || 1024, 256), 2048);
    return { width: w, height: h };
  }
}
