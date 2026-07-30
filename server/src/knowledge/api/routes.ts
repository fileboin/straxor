import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { KnowledgeEngine } from "../core/KnowledgeEngine.js";
import { FileStore } from "../storage/FileStore.js";
import path from "node:path";

const knowledgeBasePath = process.env.KNOWLEDGE_PATH || path.join(process.cwd(), "knowledge-data");
const store = new FileStore(knowledgeBasePath);
const engine = new KnowledgeEngine(store);

const router = Router();

// Middleware to ensure project store is initialized
async function withProject(req: Request, res: Response, fn: (projectId: string) => Promise<void>) {
  const projectId = req.params.projectId as string;
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  try {
    await engine.initProject(projectId);
    await fn(projectId);
  } catch (error) {
    console.error("Knowledge API error:", error);
    res.status(500).json({ error: "Knowledge operation failed" });
  }
}

// ── Project info ──

router.get("/:projectId/project", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    const project = await engine.getProject(projectId);
    res.json(project || {});
  });
});

router.put("/:projectId/project", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    await engine.projectMemory.saveProject({ id: projectId, ...req.body });
    res.json({ success: true });
  });
});

// ── Knowledge items ──

router.get("/:projectId/knowledge", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    const type = req.query.type as string | undefined;
    const items = await engine.projectMemory.listKnowledge(projectId, type);
    res.json(items);
  });
});

router.get("/:projectId/knowledge/:key", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    const item = await engine.projectMemory.getKnowledge(projectId, req.params.key as string);
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json(item);
  });
});

router.post("/:projectId/knowledge", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    const item = await engine.projectMemory.addKnowledge({ projectId, ...req.body });
    res.status(201).json(item);
  });
});

router.put("/:projectId/knowledge/:key", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    const item = await engine.projectMemory.updateKnowledge(projectId, req.params.key as string, req.body);
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json(item);
  });
});

router.delete("/:projectId/knowledge/:key", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    await engine.projectMemory.deleteKnowledge(projectId, req.params.key as string);
    res.json({ success: true });
  });
});

// ── Knowledge Graph ──

router.get("/:projectId/graph/nodes", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    res.json(await engine.graph.listNodes(projectId));
  });
});

router.post("/:projectId/graph/nodes", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    const { label, type, properties } = req.body;
    const node = await engine.graph.addNode(projectId, label, type || "default", properties);
    res.status(201).json(node);
  });
});

router.delete("/:projectId/graph/nodes/:nodeId", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    await engine.graph.deleteNode(projectId, req.params.nodeId as string);
    res.json({ success: true });
  });
});

router.get("/:projectId/graph/edges", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    res.json(await engine.graph.listEdges(projectId));
  });
});

router.post("/:projectId/graph/edges", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    const { sourceId, targetId, relation, properties } = req.body;
    const edge = await engine.graph.addEdge(projectId, sourceId, targetId, relation, properties);
    if (!edge) { res.status(400).json({ error: "Invalid source or target" }); return; }
    res.status(201).json(edge);
  });
});

router.get("/:projectId/graph/connected/:nodeId", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    res.json(await engine.graph.getConnected(projectId, req.params.nodeId as string));
  });
});

// ── Decisions ──

router.get("/:projectId/decisions", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    res.json(await engine.decisions.list(projectId));
  });
});

router.post("/:projectId/decisions", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    const decision = await engine.decisions.record(projectId, req.body);
    res.status(201).json(decision);
  });
});

router.put("/:projectId/decisions/:id", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    const updated = await engine.decisions.update(projectId, req.params.id as string, req.body);
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  });
});

router.delete("/:projectId/decisions/:id", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    await engine.decisions.delete(projectId, req.params.id as string);
    res.json({ success: true });
  });
});

// ── Documentation ──

router.get("/:projectId/docs", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    const category = req.query.category as string | undefined;
    res.json(await engine.docs.listDocs(projectId, category));
  });
});

router.post("/:projectId/docs", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    const doc = await engine.docs.saveDoc(projectId, req.body);
    res.status(201).json(doc);
  });
});

router.delete("/:projectId/docs/:id", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    await engine.docs.deleteDoc(projectId, req.params.id as string);
    res.json({ success: true });
  });
});

// ── Versions ──

router.get("/:projectId/versions", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    res.json(await engine.versions.listVersions(projectId));
  });
});

router.post("/:projectId/versions", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    const snapshot = await engine.versions.createSnapshot(projectId, req.body);
    res.status(201).json(snapshot);
  });
});

// ── Search ──

router.get("/:projectId/search", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    const query = req.query.q as string;
    if (!query) { res.json([]); return; }
    res.json(await engine.searchAll(projectId, query));
  });
});

// ── Context ──

router.post("/:projectId/context", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    const context = await engine.buildContext(projectId, req.body);
    res.json(context);
  });
});

// ── Auto learn ──

router.post("/:projectId/learn", requireAuth, (req: Request, res: Response) => {
  withProject(req, res, async (projectId) => {
    const { key, value, summary, type, source } = req.body;
    const item = await engine.projectMemory.autoLearn(projectId, key, value, summary, type, source);
    res.status(201).json(item);
  });
});

export default router;
