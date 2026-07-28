import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  ASSET_COLLECTIONS,
  LUCIDE_ICONS_SAMPLE,
  BRAND_ASSETS,
  DESIGN_TOKENS,
  type AssetCategory,
} from "../adapters/design-assets/types.js";

const router = Router();

// GET /api/design-assets/collections — list all collections
router.get("/collections", requireAuth, (_req, res) => {
  res.json(ASSET_COLLECTIONS);
});

// GET /api/design-assets/icons — get Lucide icon samples
router.get("/icons", requireAuth, (req, res) => {
  const { category, search } = req.query;

  let icons = [...LUCIDE_ICONS_SAMPLE, ...BRAND_ASSETS];

  if (category && typeof category === "string") {
    icons = icons.filter((i) => i.category === category);
  }
  if (search && typeof search === "string") {
    const q = search.toLowerCase();
    icons = icons.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.tags.some((t) => t.includes(q)) ||
        i.description.toLowerCase().includes(q)
    );
  }

  res.json(icons);
});

// GET /api/design-assets/tokens — get design tokens
router.get("/tokens", requireAuth, (req, res) => {
  const { category } = req.query;

  let tokens = [...DESIGN_TOKENS];
  if (category && typeof category === "string") {
    tokens = tokens.filter((t) => t.category === category);
  }

  res.json(tokens);
});

// GET /api/design-assets/stats — asset stats
router.get("/stats", requireAuth, (_req, res) => {
  const totalIcons = LUCIDE_ICONS_SAMPLE.length + BRAND_ASSETS.length;
  const totalTokens = DESIGN_TOKENS.length;
  const totalCollections = ASSET_COLLECTIONS.length;
  const installedCollections = ASSET_COLLECTIONS.filter((c) => c.isInstalled).length;
  const totalAssets = ASSET_COLLECTIONS.reduce((s, c) => s + c.assetCount, 0);

  res.json({
    totalIcons,
    totalTokens,
    totalCollections,
    installedCollections,
    totalAssets,
    categories: [...new Set([...LUCIDE_ICONS_SAMPLE, ...BRAND_ASSETS].map((i) => i.category))],
    tokenCategories: [...new Set(DESIGN_TOKENS.map((t) => t.category))],
  });
});

export default router;
