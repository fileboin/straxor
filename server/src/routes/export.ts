import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";
import type { ExportScope } from "../adapters/export/adapter.js";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync, statSync, createReadStream } from "fs";

const router = Router();

// POST /api/export — generate export archive
router.post("/", requireAuth, async (req, res) => {
  try {
    const { projectId, scopes, machineId, branch, includeNodeModules, includeGitHistory } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: "projectId required" });
    }

    const adapter = getAdapters().export;

    const result = await adapter.export({
      format: "zip",
      scopes: scopes || ["all"],
      projectId,
      machineId,
      branch,
      includeNodeModules: includeNodeModules || false,
      includeGitHistory: includeGitHistory || false,
    });

    res.json(result);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Export failed" });
  }
});

// GET /api/export/manifest — preview what would be exported
router.get("/manifest", requireAuth, async (req, res) => {
  try {
    const { projectId, scopes, machineId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: "projectId required" });
    }

    const adapter = getAdapters().export;

    const manifest = await adapter.getManifest({
      format: "zip",
      scopes: scopes ? (scopes as string).split(",") as ExportScope[] : ["all"],
      projectId: projectId as string,
      machineId: machineId as string,
    });

    res.json(manifest);
  } catch (error) {
    console.error("Manifest error:", error);
    res.status(500).json({ error: "Failed to generate manifest" });
  }
});

// GET /api/export/download/:projectId — download generated ZIP
router.get("/download/:projectId", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const zipPath = join(tmpdir(), `straxor-export`, `${projectId}.zip`);

    if (!existsSync(zipPath)) {
      return res.status(404).json({ error: "Export not found. Generate export first." });
    }

    const stat = statSync(zipPath);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${projectId}.zip"`);
    res.setHeader("Content-Length", stat.size);

    const stream = createReadStream(zipPath);
    stream.pipe(res);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: "Download failed" });
  }
});

export default router;
