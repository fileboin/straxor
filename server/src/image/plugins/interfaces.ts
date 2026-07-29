export interface ImagePlugin {
  name: string;
  version: string;
  onImageEvent?(event: ImageEvent): Promise<void>;
  onBeforeGeneration?(request: ImageGenerationRequest): Promise<ImageGenerationRequest>;
  onAfterGeneration?(result: ImageGenerationResult[]): Promise<ImageGenerationResult[]>;
  onBeforeOptimization?(request: OptimizationRequest): Promise<OptimizationRequest>;
  onAfterOptimization?(result: OptimizationResult): Promise<OptimizationResult>;
  init?(): Promise<void>;
  destroy?(): Promise<void>;
}

import type { ImageEvent, ImageGenerationRequest, ImageGenerationResult, OptimizationRequest, OptimizationResult } from "../core/types.js";
