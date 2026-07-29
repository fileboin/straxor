import type { ImageRecord, OptimizationRequest, OptimizationResult, ImageFormat } from "./types.js";

export class OptimizationEngine {
  async optimize(record: ImageRecord, request: OptimizationRequest): Promise<OptimizationResult> {
    const result: OptimizationResult = {
      id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      imageId: record.id,
      url: record.url,
      width: request.targetWidth || record.width,
      height: request.targetHeight || record.height,
      format: request.targetFormat || record.format,
      size: record.size,
      createdAt: new Date().toISOString(),
    };

    if (request.compress) {
      result.size = Math.round(record.size * (request.quality ?? 80) / 100);
      result.compressionRatio = record.size > 0 ? result.size / record.size : 1;
    }

    if (request.upscale && (request.targetWidth || request.targetHeight)) {
      result.width = request.targetWidth || record.width;
      result.height = request.targetHeight || record.height;
    }

    if (request.crop) {
      result.width = request.crop.width;
      result.height = request.crop.height;
    }

    return result;
  }

  canUpscale(currentWidth: number, currentHeight: number, targetWidth: number, targetHeight: number): boolean {
    const factor = Math.max(targetWidth / currentWidth, targetHeight / currentHeight);
    return factor <= 4 && factor >= 1;
  }

  suggestFormats(currentFormat: ImageFormat, useCase: string): ImageFormat[] {
    const suggestions: Record<string, ImageFormat[]> = {
      web: ["webp", "png", "avif"],
      print: ["png", "jpeg"],
      social: ["png", "jpeg"],
      icon: ["png", "svg"],
      favicon: ["png", "svg"],
    };

    return suggestions[useCase] ?? ["png", "webp"];
  }

  estimateSize(width: number, height: number, format: ImageFormat, quality = 80): number {
    const basePixels = width * height;
    const formatMultipliers: Record<ImageFormat, number> = {
      png: 0.003,
      jpeg: 0.0015,
      webp: 0.001,
      svg: 0.0001,
      avif: 0.0008,
    };
    return Math.round(basePixels * (formatMultipliers[format] ?? 0.002) * (quality / 100));
  }
}
