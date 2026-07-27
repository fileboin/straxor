import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";
import { createSSHSearchAdapter } from "../adapters/search/ssh.js";
import type { SearchMode } from "../adapters/search/adapter.js";

const router = Router();

function getSearch(userId: string) {
  const runtime = getAdapters().runtime(userId);
  const exec = (machineId: string, cmd: string) => runtime.executeCommand(machineId, cmd);
  return createSSHSearchAdapter(exec);
}

// GET /api/search — general search
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, query, mode, rootPath, filePattern, caseSensitive, maxResults } = req.query;

    if (!machineId || !query) {
      return res.status(400).json({ error: "machineId and query required" });
    }

    const search = getSearch(userId);
    const result = await search.search({
      machineId,
      query,
      mode: (mode as SearchMode) || "text",
      rootPath: rootPath || undefined,
      filePattern: filePattern || undefined,
      caseSensitive: caseSensitive === "true",
      maxResults: maxResults ? parseInt(maxResults, 10) : undefined,
    });

    res.json(result);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// GET /api/search/filename — filename-only search
router.get("/filename", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, pattern, rootPath } = req.query;

    if (!machineId || !pattern) {
      return res.status(400).json({ error: "machineId and pattern required" });
    }

    const search = getSearch(userId);
    const results = await search.searchFilename(machineId, pattern, rootPath);

    res.json({ results, stats: { totalMatches: results.length, filesSearched: results.length, duration: 0 } });
  } catch (error) {
    console.error("Filename search error:", error);
    res.status(500).json({ error: "Filename search failed" });
  }
});

export default router;
