import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";
import { createPlaywrightBrowserAdapter } from "../adapters/browser/playwright.js";
import type { BrowserVerificationRequest } from "../adapters/browser/adapter.js";

const router = Router();

function getBrowserAdapter(userId: string) {
  const runtime = getAdapters().runtime(userId);
  return createPlaywrightBrowserAdapter((machineId, cmd) =>
    runtime.executeCommand(machineId, cmd)
  );
}

// POST /api/browser-verify — full browser verification
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, url, checks, viewport, waitFor, forms, screenshotNames } =
      req.body as BrowserVerificationRequest;

    if (!machineId || !url) {
      return res.status(400).json({ error: "machineId and url required" });
    }

    const adapter = getBrowserAdapter(userId);
    const result = await adapter.verify({
      machineId,
      url,
      checks,
      viewport,
      waitFor,
      forms,
      screenshotNames,
    });

    res.json(result);
  } catch (error) {
    console.error("Error running browser verification:", error);
    res.status(500).json({ error: "Browser verification failed" });
  }
});

// POST /api/browser-verify/screenshot — take a single screenshot
router.post("/screenshot", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, url, name, viewport } = req.body;

    if (!machineId || !url) {
      return res.status(400).json({ error: "machineId and url required" });
    }

    const adapter = getBrowserAdapter(userId);
    const screenshot = await adapter.takeScreenshot(
      machineId,
      url,
      name || "screenshot",
      viewport
    );

    res.json(screenshot);
  } catch (error) {
    console.error("Error taking screenshot:", error);
    res.status(500).json({ error: "Screenshot failed" });
  }
});

// POST /api/browser-verify/forms — test forms only
router.post("/forms", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, url, forms } = req.body;

    if (!machineId || !url || !forms) {
      return res.status(400).json({ error: "machineId, url, and forms required" });
    }

    const adapter = getBrowserAdapter(userId);
    const result = await adapter.checkForms(machineId, url, forms);

    res.json(result);
  } catch (error) {
    console.error("Error testing forms:", error);
    res.status(500).json({ error: "Form testing failed" });
  }
});

export default router;
