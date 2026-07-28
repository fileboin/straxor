import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createWebResearchAdapter } from "../adapters/web-research/registry.js";
import { WEB_RESEARCH_PROVIDER_LABELS, type WebResearchResponse } from "../adapters/web-research/adapter.js";

const router = Router();
const adapter = createWebResearchAdapter();

// GET /api/web-research/providers — list available providers
router.get("/providers", requireAuth, (_req, res) => {
  const ids = adapter.getProviders();
  res.json(ids.map((id) => ({ id, name: WEB_RESEARCH_PROVIDER_LABELS[id] || id, enabled: true })));
});

// POST /api/web-research/search — search the web
router.post("/search", requireAuth, async (req: any, res) => {
  try {
    const { query, provider, maxResults, includeRaw, siteFilter, dateFilter, language } = req.body;
    if (!query || !provider) {
      res.status(400).json({ error: "Missing required fields: query, provider" });
      return;
    }

    const result = await adapter.search({ query, provider, maxResults, includeRaw, siteFilter, dateFilter, language });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Search failed" });
  }
});

// POST /api/web-research/search-all — search all providers
router.post("/search-all", requireAuth, async (req: any, res) => {
  try {
    const { query, maxResults, includeRaw } = req.body;
    if (!query) {
      res.status(400).json({ error: "Missing required field: query" });
      return;
    }

    const providers = adapter.getProviders();
    const results = await Promise.allSettled(
      providers.map((provider) =>
        adapter.search({ query, provider, maxResults, includeRaw })
      )
    );

    const responses = results
      .filter((r) => r.status === "fulfilled")
      .map((r: any) => r.value);

    res.json({
      query,
      responses,
      totalResults: responses.reduce((s: number, r: WebResearchResponse) => s + r.totalResults, 0),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Search-all failed" });
  }
});

export default router;
