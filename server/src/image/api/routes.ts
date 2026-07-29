import { Router } from "express";
import type { Request, Response } from "express";
import { ImageEngine } from "../core/ImageEngine.js";
import { FileImageStore } from "../storage/FileStore.js";
import { MemoryImageStore } from "../storage/MemoryStore.js";
import { NanoBananaAdapter } from "../providers/nanobanana.js";
import { GPTImageAdapter } from "../providers/gpt-image.js";
import { GeminiImageAdapter } from "../providers/gemini-image.js";
import { FluxAdapter } from "../providers/flux.js";
import { StableDiffusionAdapter } from "../providers/stable-diffusion.js";
import { ComfyUIAdapter } from "../providers/comfy-ui.js";
import { QwenImageAdapter } from "../providers/qwen-image.js";
import { requireAuth } from "../../middleware/auth.js";

const useFileStore = process.env.IMAGE_STORE_TYPE !== "memory";
const store = useFileStore ? new FileImageStore() : new MemoryImageStore();
export const imageEngine = new ImageEngine(store);

imageEngine.registerProvider(new NanoBananaAdapter());
imageEngine.registerProvider(new GPTImageAdapter());
imageEngine.registerProvider(new GeminiImageAdapter());
imageEngine.registerProvider(new FluxAdapter());
imageEngine.registerProvider(new StableDiffusionAdapter());
imageEngine.registerProvider(new ComfyUIAdapter());
imageEngine.registerProvider(new QwenImageAdapter());

imageEngine.restoreFromStore();

const router = Router();
router.use(requireAuth);

function withProject(req: Request, res: Response, next: () => void): void {
  const projectId = req.headers["x-project-id"] as string | undefined;
  if (projectId) (req as any).projectId = projectId;
  next();
}

router.use(withProject);

// ── Generation ──

router.post("/generate", async (req, res) => {
  try {
    const result = await imageEngine.generate({
      ...req.body,
      projectId: req.body.projectId || (req as any).projectId,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/generate/asset", async (req, res) => {
  try {
    const { type, subject, projectId, brand } = req.body;
    const result = await imageEngine.generateAsset(type, subject, projectId || (req as any).projectId, brand);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Images / Library ──

router.get("/images", async (req, res) => {
  try {
    const { projectId, tags, assetType, limit, offset } = req.query;
    const result = await store.listImages(
      projectId as string || (req as any).projectId,
      tags ? (tags as string).split(",") : undefined,
      assetType as string,
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/images/:id", async (req, res) => {
  try {
    const image = await store.getImage(req.params.id);
    if (!image) return res.status(404).json({ error: "Image not found" });
    res.json(image);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/images/:id", async (req, res) => {
  try {
    imageEngine.library.delete(req.params.id);
    await store.deleteImage(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/images/:id", async (req, res) => {
  try {
    const updated = imageEngine.library.update(req.params.id, req.body);
    if (updated) await store.updateImage(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/images/search", async (req, res) => {
  try {
    const { q, projectId } = req.query;
    const result = await store.searchImages(q as string, projectId as string || (req as any).projectId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Optimization ──

router.post("/optimize", async (req, res) => {
  try {
    const result = await imageEngine.optimize(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/optimize/:imageId", async (req, res) => {
  try {
    const results = await store.listOptimizationResults(req.params.imageId);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Quality ──

router.post("/quality/:imageId", async (req, res) => {
  try {
    const result = await imageEngine.checkQuality(req.params.imageId, req.body.expectedAspectRatio);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Styles ──

router.get("/styles", async (req, res) => {
  try {
    const { category } = req.query;
    res.json(imageEngine.styles.list(category as string));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/styles", async (req, res) => {
  try {
    const style = { ...req.body, id: `style-${Date.now()}`, isBuiltin: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    imageEngine.styles.register(style);
    await store.saveStyle(style);
    res.json(style);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/styles/:id", async (req, res) => {
  try {
    imageEngine.styles.delete(req.params.id);
    await store.deleteStyle(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Prompt Templates ──

router.get("/templates", async (req, res) => {
  try {
    const { category } = req.query;
    res.json(imageEngine.templates.list(category as string));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/templates", async (req, res) => {
  try {
    const tpl = { ...req.body, id: `tpl-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    imageEngine.templates.register(tpl);
    await store.savePromptTemplate(tpl);
    res.json(tpl);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/templates/:id", async (req, res) => {
  try {
    imageEngine.templates.delete(req.params.id);
    await store.deletePromptTemplate(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Prompt History ──

router.get("/prompt-history", async (req, res) => {
  try {
    const { limit } = req.query;
    res.json(imageEngine.prompt.getHistory(limit ? Number(limit) : 50));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Branding ──

router.post("/branding", async (req, res) => {
  try {
    const { projectId, name } = req.body;
    const brand = await imageEngine.createBrand(projectId || (req as any).projectId, name);
    res.json(brand);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/branding/:projectId", async (req, res) => {
  try {
    const brand = await imageEngine.getBrand(req.params.projectId);
    if (!brand) return res.status(404).json({ error: "Brand not found" });
    res.json(brand);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/branding/:projectId", async (req, res) => {
  try {
    const brand = imageEngine.brands.updateBrand(req.params.projectId, req.body);
    if (!brand) return res.status(404).json({ error: "Brand not found" });
    await store.saveBrand(brand);
    res.json(brand);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/branding/:projectId", async (req, res) => {
  try {
    imageEngine.brands.deleteBrand(req.params.projectId);
    await store.deleteBrand(req.params.projectId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Costs ──

router.get("/costs", async (req, res) => {
  try {
    const { projectId, provider, limit } = req.query;
    const records = await store.listCostRecords(
      projectId as string || (req as any).projectId,
      provider as string,
      limit ? Number(limit) : 100,
    );
    res.json({
      records,
      total: imageEngine.costs.getTotalCost(),
      byProvider: Object.fromEntries(imageEngine.costs.getCostByProvider()),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/costs/budget", async (req, res) => {
  try {
    const { projectId, maxCost } = req.body;
    imageEngine.costs.setBudget(projectId || (req as any).projectId, maxCost);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Providers ──

router.get("/providers", async (_req, res) => {
  try {
    const providers = imageEngine.providers.listProviders().map(({ adapter, config }) => ({
      ...config,
      name: adapter.name,
      displayName: adapter.displayName,
      supportedFormats: adapter.supportedFormats,
      maxDimensions: adapter.maxDimensions,
      available: adapter.isAvailable(),
    }));
    res.json(providers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/providers/:name", async (req, res) => {
  try {
    imageEngine.providers.updateConfig(req.params.name, req.body);
    const config = imageEngine.providers.getConfig(req.params.name);
    if (config) {
      await store.saveProviderConfig({
        name: req.params.name,
        displayName: config.displayName,
        isEnabled: config.isEnabled,
        priority: config.priority,
        costPerImage: config.costPerImage,
        maxWidth: config.maxDimensions.width,
        maxHeight: config.maxDimensions.height,
        supportedFormats: config.supportedFormats.join(","),
        updatedAt: new Date().toISOString(),
      });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Strategy ──

router.post("/strategy", async (req, res) => {
  try {
    imageEngine.setDefaultStrategy(req.body.strategy);
    res.json({ success: true, strategy: req.body.strategy });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Events ──

router.get("/events", async (req, res) => {
  try {
    const { projectId, type, limit } = req.query;
    const events = await store.listEvents(
      projectId as string || (req as any).projectId,
      type as string,
      limit ? Number(limit) : 100,
    );
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Plugins ──

router.get("/plugins", async (_req, res) => {
  try {
    const plugins = imageEngine.plugins.list().map(p => ({ name: p.name, version: p.version }));
    res.json(plugins);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Asset Specs ──

router.get("/asset-specs", async (_req, res) => {
  try {
    res.json(imageEngine.assets.listTypes());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
