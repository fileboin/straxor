import type { ImageGenerationRequest, ImageGenerationResult, ImageEvent } from "./types.js";

export class ImagePipeline {
  private hooks: PipelineHook[] = [];

  registerHook(hook: PipelineHook): void {
    this.hooks.push(hook);
  }

  unregisterHook(name: string): void {
    this.hooks = this.hooks.filter(h => h.name !== name);
  }

  async execute(
    request: ImageGenerationRequest,
    generateFn: (req: ImageGenerationRequest) => Promise<ImageGenerationResult[]>,
    onEvent?: (event: ImageEvent) => void,
  ): Promise<ImageGenerationResult[]> {
    let currentRequest = { ...request };

    for (const hook of this.hooks) {
      if (hook.onBeforeGeneration) {
        currentRequest = await hook.onBeforeGeneration(currentRequest);
      }
    }

    onEvent?.({ type: "generation:started", projectId: request.projectId, data: { prompt: request.prompt }, timestamp: new Date().toISOString() });

    let results: ImageGenerationResult[];
    try {
      results = await generateFn(currentRequest);
    } catch (error) {
      onEvent?.({ type: "generation:failed", projectId: request.projectId, data: { prompt: request.prompt, error: String(error) }, timestamp: new Date().toISOString() });
      throw error;
    }

    for (const hook of this.hooks) {
      if (hook.onAfterGeneration) {
        results = await hook.onAfterGeneration(results);
      }
    }

    onEvent?.({ type: "generation:completed", projectId: request.projectId, data: { prompt: request.prompt, count: results.length }, timestamp: new Date().toISOString() });

    return results;
  }
}

export interface PipelineHook {
  name: string;
  onBeforeGeneration?(request: ImageGenerationRequest): Promise<ImageGenerationRequest>;
  onAfterGeneration?(results: ImageGenerationResult[]): Promise<ImageGenerationResult[]>;
}
