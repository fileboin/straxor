import type { ImageGenerationRequest, ImageGenerationResult, ImageFormat } from "../core/types.js";

export interface ImageProviderAdapter {
  name: string;
  displayName: string;
  supportedFormats: ImageFormat[];
  maxDimensions: { width: number; height: number };

  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult[]>;
  isAvailable(): boolean;
  estimateCost(request: ImageGenerationRequest): number;
  estimateDuration(request: ImageGenerationRequest): number;
}
