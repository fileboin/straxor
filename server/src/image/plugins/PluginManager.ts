import type { ImagePlugin } from "./interfaces.js";
import type { ImageEvent, ImageGenerationRequest, ImageGenerationResult, OptimizationRequest, OptimizationResult } from "../core/types.js";

export class PluginManager {
  private plugins = new Map<string, ImagePlugin>();

  async register(plugin: ImagePlugin): Promise<void> {
    this.plugins.set(plugin.name, plugin);
    if (plugin.init) await plugin.init();
  }

  async unregister(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (plugin?.destroy) await plugin.destroy();
    this.plugins.delete(name);
  }

  async destroyAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.destroy) await plugin.destroy();
    }
    this.plugins.clear();
  }

  async onImageEvent(event: ImageEvent): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onImageEvent) await plugin.onImageEvent(event).catch(() => {});
    }
  }

  async onBeforeGeneration(request: ImageGenerationRequest): Promise<ImageGenerationRequest | null> {
    let current = { ...request };
    for (const plugin of this.plugins.values()) {
      if (plugin.onBeforeGeneration) {
        current = await plugin.onBeforeGeneration(current);
      }
    }
    return current;
  }

  async onAfterGeneration(results: ImageGenerationResult[]): Promise<ImageGenerationResult[] | null> {
    let current = [...results];
    for (const plugin of this.plugins.values()) {
      if (plugin.onAfterGeneration) {
        current = await plugin.onAfterGeneration(current);
      }
    }
    return current;
  }

  async onBeforeOptimization(request: OptimizationRequest): Promise<OptimizationRequest | null> {
    let current = { ...request };
    for (const plugin of this.plugins.values()) {
      if (plugin.onBeforeOptimization) {
        current = await plugin.onBeforeOptimization(current);
      }
    }
    return current;
  }

  async onAfterOptimization(result: OptimizationResult): Promise<OptimizationResult | null> {
    let current = { ...result };
    for (const plugin of this.plugins.values()) {
      if (plugin.onAfterOptimization) {
        current = await plugin.onAfterOptimization(current);
      }
    }
    return current;
  }

  list(): ImagePlugin[] {
    return Array.from(this.plugins.values());
  }

  get(name: string): ImagePlugin | undefined {
    return this.plugins.get(name);
  }
}
