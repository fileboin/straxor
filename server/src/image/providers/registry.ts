import type { ImageProviderAdapter } from "./interfaces.js";
import type { ImageGenerationRequest, ProviderConfig } from "../core/types.js";

export class ProviderRegistry {
  private providers = new Map<string, ImageProviderAdapter>();
  private configs = new Map<string, ProviderConfig>();

  register(adapter: ImageProviderAdapter, config?: Partial<ProviderConfig>): void {
    this.providers.set(adapter.name, adapter);
    this.configs.set(adapter.name, {
      name: adapter.name,
      displayName: adapter.displayName,
      isEnabled: true,
      priority: 100,
      costPerImage: 0.01,
      maxDimensions: adapter.maxDimensions,
      supportedFormats: adapter.supportedFormats,
      ...config,
    });
  }

  unregister(name: string): void {
    this.providers.delete(name);
    this.configs.delete(name);
  }

  getProvider(name: string): ImageProviderAdapter | undefined {
    return this.providers.get(name);
  }

  getConfig(name: string): ProviderConfig | undefined {
    return this.configs.get(name);
  }

  updateConfig(name: string, updates: Partial<ProviderConfig>): void {
    const existing = this.configs.get(name);
    if (existing) {
      this.configs.set(name, { ...existing, ...updates });
    }
  }

  getAvailableProviders(): ImageProviderAdapter[] {
    return Array.from(this.providers.values()).filter(p => {
      const config = this.configs.get(p.name);
      return config?.isEnabled !== false && p.isAvailable();
    });
  }

  selectProvider(strategy: "lowest-cost" | "highest-quality" | "fastest-speed" | "user-preference", preferredName?: string): ImageProviderAdapter | undefined {
    if (preferredName) {
      const preferred = this.providers.get(preferredName);
      if (preferred) {
        const config = this.configs.get(preferredName);
        if (config?.isEnabled !== false && preferred.isAvailable()) return preferred;
      }
    }

    const available = this.getAvailableProviders();
    if (available.length === 0) return undefined;

    switch (strategy) {
      case "lowest-cost":
        return available.reduce((a, b) => {
          const aCost = this.configs.get(a.name)?.costPerImage ?? 0;
          const bCost = this.configs.get(b.name)?.costPerImage ?? 0;
          return aCost <= bCost ? a : b;
        });
      case "fastest-speed":
        return available.reduce((a, b) => {
          const aDur = a.estimateDuration({ prompt: "" });
          const bDur = b.estimateDuration({ prompt: "" });
          return aDur <= bDur ? a : b;
        });
      case "highest-quality":
        return available.reduce((a, b) => {
          const aCost = this.configs.get(a.name)?.costPerImage ?? 0;
          const bCost = this.configs.get(b.name)?.costPerImage ?? 0;
          return aCost >= bCost ? a : b;
        });
      default:
        return available.sort((a, b) => {
          const aP = this.configs.get(a.name)?.priority ?? 100;
          const bP = this.configs.get(b.name)?.priority ?? 100;
          return aP - bP;
        })[0];
    }
  }

  listProviders(): { adapter: ImageProviderAdapter; config: ProviderConfig }[] {
    return Array.from(this.providers.entries()).map(([name, adapter]) => ({
      adapter,
      config: this.configs.get(name) ?? {
        name, displayName: adapter.displayName, isEnabled: true, priority: 100,
        costPerImage: 0.01, maxDimensions: adapter.maxDimensions,
        supportedFormats: adapter.supportedFormats,
      },
    }));
  }
}
