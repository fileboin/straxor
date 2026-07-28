import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { DesignOrchestrator } from "../adapters/design/orchestrator.js";
import { MediaLibrary } from "../adapters/design/media-library.js";
import { IMAGE_PROVIDER_LABELS } from "../adapters/design/types.js";

const router = Router();
const orchestrator = new DesignOrchestrator();
const mediaLibrary = new MediaLibrary();

// GET /api/design/providers — list available image providers
router.get("/providers", requireAuth, (_req, res) => {
  const ids = orchestrator.getImageProviders();
  res.json(
    ids.map((id) => ({
      id,
      name: IMAGE_PROVIDER_LABELS[id] || id,
      enabled: true,
    }))
  );
});

// POST /api/design/generate — generate anything (website, ui, image, presentation, design-system)
router.post("/generate", requireAuth, async (req: any, res) => {
  try {
    const { prompt, type, provider, style, layout, pages } = req.body;
    if (!prompt || !type) {
      res.status(400).json({ error: "Missing required fields: prompt, type" });
      return;
    }

    const result = await orchestrator.process({ prompt, type, provider, style, layout, pages });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Generation failed" });
  }
});

// POST /api/design/generate-image — standalone image generation
router.post("/generate-image", requireAuth, async (req: any, res) => {
  try {
    const { prompt, provider, width, height, steps, seed, style, model, negativePrompt } = req.body;
    if (!prompt || !provider) {
      res.status(400).json({ error: "Missing required fields: prompt, provider" });
      return;
    }

    const result = await orchestrator.generateImage({
      prompt,
      provider,
      width: width || 1024,
      height: height || 1024,
      steps,
      seed,
      style,
      model,
      negativePrompt,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Image generation failed" });
  }
});

// POST /api/design/generate-website — standalone website generation
router.post("/generate-website", requireAuth, async (req: any, res) => {
  try {
    const { prompt, style, layout, pages } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Missing required field: prompt" });
      return;
    }

    const result = await orchestrator.generateWebsite({ prompt, type: "website", style, layout, pages });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Website generation failed" });
  }
});

// POST /api/design/generate-ui — standalone UI component generation
router.post("/generate-ui", requireAuth, async (req: any, res) => {
  try {
    const { prompt, style } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Missing required field: prompt" });
      return;
    }

    const result = await orchestrator.generateUIComponent({ prompt, type: "ui", style });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "UI generation failed" });
  }
});

// POST /api/design/generate-presentation — standalone presentation generation
router.post("/generate-presentation", requireAuth, async (req: any, res) => {
  try {
    const { prompt, style } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Missing required field: prompt" });
      return;
    }

    const result = await orchestrator.generatePresentation({ prompt, type: "presentation", style });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Presentation generation failed" });
  }
});

// POST /api/design/generate-design-system — standalone design system generation
router.post("/generate-design-system", requireAuth, async (req: any, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Missing required field: prompt" });
      return;
    }

    const result = await orchestrator.generateDesignSystem({ prompt, type: "design-system" });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Design system generation failed" });
  }
});

// Media Library endpoints

// GET /api/design/media — list media items
router.get("/media", requireAuth, async (req: any, res) => {
  try {
    const { folder, tags, type } = req.query;
    const tagsArr = tags ? (tags as string).split(",") : undefined;
    const items = await mediaLibrary.list(folder as string, tagsArr, type as string);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list media" });
  }
});

// GET /api/design/media/search — search media
router.get("/media/search", requireAuth, async (req: any, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      res.status(400).json({ error: "Missing search query" });
      return;
    }
    const items = await mediaLibrary.search(q as string);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Search failed" });
  }
});

// DELETE /api/design/media/:id — delete media item
router.delete("/media/:id", requireAuth, async (req: any, res) => {
  try {
    const ok = await mediaLibrary.delete(req.params.id);
    res.json({ deleted: ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Delete failed" });
  }
});

// GET /api/design/media/stats — media stats
router.get("/media/stats", requireAuth, async (_req, res) => {
  try {
    const stats = await mediaLibrary.getStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Stats failed" });
  }
});

// GET /api/design/websites — list generated websites
router.get("/websites", requireAuth, async (_req, res) => {
  try {
    const websites = await orchestrator.getWebsites();
    res.json(websites);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list websites" });
  }
});

// GET /api/design/ui-components — list generated UI components
router.get("/ui-components", requireAuth, async (_req, res) => {
  try {
    const components = await orchestrator.getUIComponents();
    res.json(components);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list UI components" });
  }
});

export default router;
