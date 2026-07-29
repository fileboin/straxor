import { PromptEngine } from "./PromptEngine.js";
import { TemplateEngine } from "./TemplateEngine.js";
import { StyleEngine } from "./StyleEngine.js";
import { AssetManager } from "./AssetManager.js";
import { BrandingEngine } from "./BrandingEngine.js";
import { ImagePipeline } from "./ImagePipeline.js";
import { OptimizationEngine } from "./OptimizationEngine.js";
import { CostController } from "./CostController.js";
import { QualityController } from "./QualityController.js";
import { ImageLibrary } from "./ImageLibrary.js";
import { ProviderRegistry } from "../providers/registry.js";
import type { ImageProviderAdapter } from "../providers/interfaces.js";
import type {
  ImageGenerationRequest, ImageGenerationResult, ImageRecord, ImageFormat, ImageQuality,
  OptimizationRequest, OptimizationResult, QualityCheckResult, CostRecord, ImageEvent,
  ImageStyle, PromptTemplate, BrandIdentity, CostOptimizationStrategy, AssetType,
} from "./types.js";
import { PluginManager } from "../plugins/PluginManager.js";
import type { ImageStore } from "../storage/interfaces.js";

export class ImageEngine {
  readonly prompt: PromptEngine;
  readonly templates: TemplateEngine;
  readonly styles: StyleEngine;
  readonly assets: AssetManager;
  readonly brands: BrandingEngine;
  readonly pipeline: ImagePipeline;
  readonly optimization: OptimizationEngine;
  readonly costs: CostController;
  readonly quality: QualityController;
  readonly library: ImageLibrary;
  readonly providers: ProviderRegistry;
  readonly plugins: PluginManager;

  private store: ImageStore;
  private defaultStrategy: CostOptimizationStrategy = "user-preference";
  private onEvent?: (event: ImageEvent) => void;

  constructor(store: ImageStore) {
    this.store = store;
    this.prompt = new PromptEngine();
    this.templates = new TemplateEngine();
    this.styles = new StyleEngine();
    this.assets = new AssetManager();
    this.brands = new BrandingEngine();
    this.pipeline = new ImagePipeline();
    this.optimization = new OptimizationEngine();
    this.costs = new CostController();
    this.quality = new QualityController();
    this.library = new ImageLibrary();
    this.providers = new ProviderRegistry();
    this.plugins = new PluginManager();
  }

  setEventCallback(cb: (event: ImageEvent) => void): void {
    this.onEvent = cb;
  }

  setDefaultStrategy(strategy: CostOptimizationStrategy): void {
    this.defaultStrategy = strategy;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult[]> {
    let currentRequest = { ...request };

    const pluginRequest = await this.plugins.onBeforeGeneration(currentRequest);
    if (pluginRequest) currentRequest = pluginRequest;

    let prompt = currentRequest.prompt;

    if (currentRequest.styleId) {
      const styleApplied = this.styles.applyStyle(prompt, currentRequest.styleId);
      prompt = styleApplied.prompt;
      if (styleApplied.negativePrompt && !currentRequest.negativePrompt) {
        currentRequest.negativePrompt = styleApplied.negativePrompt;
      }
    }

    prompt = this.prompt.improvePrompt(prompt, currentRequest.styleId ? this.styles.get(currentRequest.styleId) : undefined);
    currentRequest.prompt = prompt;

    const provider = currentRequest.provider
      ? this.providers.getProvider(currentRequest.provider)
      : this.providers.selectProvider(this.defaultStrategy);

    if (!provider) {
      throw new Error("No available image provider. Configure an API key for at least one provider.");
    }

    const results = await this.pipeline.execute(
      currentRequest,
      (req) => provider.generate(req),
      (event) => {
        this.onEvent?.(event);
        this.plugins.onImageEvent(event);
      },
    );

    const pluginResults = await this.plugins.onAfterGeneration(results);
    const finalResults = pluginResults ?? results;

    for (const result of finalResults) {
      const record: ImageRecord = {
        id: result.id,
        projectId: currentRequest.projectId,
        url: result.url,
        width: result.width,
        height: result.height,
        format: result.format,
        size: 0,
        provider: result.provider,
        model: result.model,
        prompt: currentRequest.prompt,
        negativePrompt: currentRequest.negativePrompt,
        styleId: currentRequest.styleId,
        tags: currentRequest.tags ?? [],
        assetType: currentRequest.assetType,
        version: 1,
        cost: result.cost,
        duration: result.duration,
        quality: currentRequest.quality ?? "standard",
        metadata: {},
        createdAt: result.createdAt,
        updatedAt: result.createdAt,
      };

      this.library.add(record);
      await this.store.saveImage(record).catch(() => {});

      this.costs.recordCost(
        result.provider, 1, result.cost, result.duration,
        result.width, result.height,
        currentRequest.quality ?? "standard",
        currentRequest.projectId,
      );

      this.prompt.addHistory({
        id: `ph-${Date.now()}`,
        originalPrompt: request.prompt,
        improvedPrompt: prompt,
        provider: result.provider,
        imageUrl: result.url,
        duration: result.duration,
        createdAt: new Date().toISOString(),
      });
    }

    return finalResults;
  }

  async generateAsset(type: AssetType, subject: string, projectId?: string, brand?: string): Promise<ImageGenerationResult[]> {
    const prompt = this.assets.getPromptForType(type, brand, subject);
    const spec = this.assets.getSpec(type);
    return this.generate({
      prompt,
      width: spec.width,
      height: spec.height,
      format: spec.format,
      assetType: type,
      projectId,
      tags: [type],
    });
  }

  async optimize(request: OptimizationRequest): Promise<OptimizationResult> {
    const record = this.library.get(request.imageId);
    if (!record) throw new Error(`Image ${request.imageId} not found`);

    const pluginRequest = await this.plugins.onBeforeOptimization(request);
    const finalRequest = pluginRequest ?? request;

    const result = await this.optimization.optimize(record, finalRequest);

    const pluginResult = await this.plugins.onAfterOptimization(result);
    const finalResult = pluginResult ?? result;

    await this.store.saveOptimizationResult(finalResult).catch(() => {});

    this.onEvent?.({
      type: "optimization:completed",
      projectId: record.projectId,
      data: { imageId: record.id, resultId: finalResult.id },
      timestamp: new Date().toISOString(),
    });

    return finalResult;
  }

  async checkQuality(imageId: string, expectedAspectRatio?: number): Promise<QualityCheckResult> {
    const record = this.library.get(imageId);
    if (!record) throw new Error(`Image ${imageId} not found`);
    return this.quality.check(record, expectedAspectRatio);
  }

  async createBrand(projectId: string, name: string): Promise<BrandIdentity> {
    const brand = this.brands.createBrand(projectId, name);
    await this.store.saveBrand(brand).catch(() => {});
    this.onEvent?.({ type: "brand:created", projectId, data: { brandId: brand.id, name }, timestamp: new Date().toISOString() });
    return brand;
  }

  async getBrand(projectId: string): Promise<BrandIdentity | null> {
    return this.brands.getBrand(projectId) ?? null;
  }

  async registerProvider(adapter: ImageProviderAdapter, config?: { apiKey?: string; baseUrl?: string; model?: string; isEnabled?: boolean; priority?: number; costPerImage?: number }): Promise<void> {
    this.providers.register(adapter, {
      ...config,
      isEnabled: config?.isEnabled ?? true,
      priority: config?.priority ?? 100,
      costPerImage: config?.costPerImage ?? 0.01,
    });
    await this.store.saveProviderConfig({
      name: adapter.name,
      displayName: adapter.displayName,
      apiKey: config?.apiKey,
      baseUrl: config?.baseUrl,
      model: config?.model,
      isEnabled: config?.isEnabled ?? true,
      priority: config?.priority ?? 100,
      costPerImage: config?.costPerImage ?? 0.01,
      maxWidth: adapter.maxDimensions.width,
      maxHeight: adapter.maxDimensions.height,
      supportedFormats: adapter.supportedFormats.join(","),
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  async restoreFromStore(): Promise<void> {
    const images = await this.store.listImages().catch(() => [] as ImageRecord[]);
    for (const img of images) this.library.add(img);

    const styles = await this.store.listStyles().catch(() => [] as ImageStyle[]);
    for (const s of styles) this.styles.register(s);

    const templates = await this.store.listPromptTemplates().catch(() => [] as PromptTemplate[]);
    for (const t of templates) this.templates.register(t);

    const brands = await Promise.all(
      (await this.store.listProviderConfigs().catch(() => [])).map(async () => null),
    ).catch(() => []);

    const providerConfigs = await this.store.listProviderConfigs().catch(() => []);
    for (const pc of providerConfigs) {
      const adapter = this.providers.getProvider(pc.name);
      if (adapter) {
        this.providers.updateConfig(pc.name, {
          isEnabled: pc.isEnabled,
          priority: pc.priority,
          costPerImage: pc.costPerImage,
        });
      }
    }
  }

  async shutdown(): Promise<void> {
    await this.plugins.destroyAll();
  }
}
