import { Router } from "express";
import type { Request, Response } from "express";
import { ImageAgent } from "../image-agent.js";
import { imageEngine } from "../../../image/api/routes.js";

const imageAgent = new ImageAgent(imageEngine);
const router = Router();

// ── Generation ──

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { prompt, domainMode, brandPresetId, aspectRatio, resolution, model, n, sessionId } = req.body;
    const projectId = req.body.projectId || (req as any).projectId || "default";

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const result = await imageAgent.generate({
      prompt,
      domainMode,
      brandPresetId,
      aspectRatio,
      resolution,
      model,
      n: Math.min(n || 1, 8),
      sessionId,
      projectId,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Session management ──

router.get("/sessions", (req: Request, res: Response) => {
  try {
    const projectId = (req.query.projectId as string) || (req as any).projectId || "default";
    const sessions = imageAgent.listSessions(projectId);
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/sessions/:id", (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const session = imageAgent.getSession(id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/sessions/:id", (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const deleted = imageAgent.deleteSession(id);
    if (!deleted) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sessions/:id/clear", (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const session = imageAgent.clearMessages(id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Prompt tools ──

router.post("/decompose", (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "prompt is required" });
      return;
    }
    const components = imageAgent.getPromptComponents(prompt);
    res.json(components);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Domain modes ──

router.get("/domain-modes", (_req: Request, res: Response) => {
  try {
    const modes = imageAgent.listDomainModes();
    res.json(modes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Brand presets ──

router.get("/brand-presets", (_req: Request, res: Response) => {
  try {
    const presets = imageAgent.listBrandPresets();
    res.json(presets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as imageAgentRoutes };
