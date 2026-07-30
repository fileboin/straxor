import { Router } from "express";
import type { Request, Response } from "express";
import { ConnectionManager } from "../core/ConnectionManager.js";
import type { ConnectionCategory } from "../core/types.js";
import { registerAll as registerAutomation } from "../automation/index.js";
import { registerAll as registerHardware } from "../hardware/index.js";
import { registerAll as registerNetwork } from "../network/index.js";
import { registerAll as registerCloud } from "../cloud/index.js";
import { registerAll as registerAI } from "../ai/index.js";
import { registerAll as registerCustom } from "../custom/index.js";

import { PostgresConnectionStore } from "../storage/PostgresConnectionStore.js";

export function createConnectionsRouter(): Router {
  const store = process.env.DATABASE_URL ? new PostgresConnectionStore() : undefined;
  const manager = new ConnectionManager(store);
  registerAutomation(a => manager.registerAdapter(a));
  registerHardware(a => manager.registerAdapter(a));
  registerNetwork(a => manager.registerAdapter(a));
  registerCloud(a => manager.registerAdapter(a));
  registerAI(a => manager.registerAdapter(a));
  registerCustom(a => manager.registerAdapter(a));

  const router = Router();

  // ── Stats ──
  router.get("/stats", (_req: Request, res: Response) => {
    res.json(manager.getStats());
  });

  // ── Adapters ──
  router.get("/adapters", (req: Request, res: Response) => {
    const category = req.query.category as ConnectionCategory | undefined;
    const adapters = manager.listAdapters(category);
    res.json({ adapters: adapters.map(a => ({
      name: a.name, displayName: a.displayName, category: a.category,
      description: a.description, icon: a.icon, authType: a.authType,
      configSchema: a.configSchema, operations: a.getOperations(),
    })) });
  });

  router.get("/adapters/:name", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const adapter = manager.getAdapter(name);
    if (!adapter) { res.status(404).json({ error: "Adapter not found" }); return; }
    res.json({
      name: adapter.name, displayName: adapter.displayName, category: adapter.category,
      description: adapter.description, icon: adapter.icon, authType: adapter.authType,
      configSchema: adapter.configSchema, operations: adapter.getOperations(),
    });
  });

  router.get("/adapters/:name/operations", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const ops = manager.getOperations(name);
    res.json({ operations: ops });
  });

  // ── Instances ──
  router.get("/instances", (req: Request, res: Response) => {
    const category = req.query.category as ConnectionCategory | undefined;
    res.json({ instances: manager.listInstances(category) });
  });

  router.post("/instances", (req: Request, res: Response) => {
    const { adapterName, name, config } = req.body;
    if (!adapterName || !name) { res.status(400).json({ error: "adapterName and name required" }); return; }
    try {
      const instance = manager.createInstance(adapterName, name, config || {});
      res.status(201).json(instance);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get("/instances/:id", (req: Request, res: Response) => {
    const id = req.params.id as string;
    const instance = manager.getInstance(id);
    if (!instance) { res.status(404).json({ error: "Instance not found" }); return; }
    res.json(instance);
  });

  router.put("/instances/:id", (req: Request, res: Response) => {
    const id = req.params.id as string;
    const instance = manager.updateInstance(id, req.body);
    if (!instance) { res.status(404).json({ error: "Instance not found" }); return; }
    res.json(instance);
  });

  router.delete("/instances/:id", (req: Request, res: Response) => {
    const id = req.params.id as string;
    const deleted = manager.deleteInstance(id);
    if (!deleted) { res.status(404).json({ error: "Instance not found" }); return; }
    res.json({ success: true });
  });

  // ── Test ──
  router.post("/instances/:id/test", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
      const result = await manager.testConnection(id);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Execute ──
  router.post("/instances/:id/execute", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { operation, payload } = req.body;
    if (!operation) { res.status(400).json({ error: "operation required" }); return; }
    try {
      const result = await manager.execute(id, operation, payload);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Events ──
  router.get("/events", (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json({ events: manager.getEvents(limit) });
  });

  // ── Categories ──
  router.get("/categories", (_req: Request, res: Response) => {
    const byCategory = manager.listAdaptersByCategory();
    res.json({
      categories: Object.entries(byCategory).map(([key, adapters]) => ({
        id: key, name: key.charAt(0).toUpperCase() + key.slice(1),
        count: adapters.length,
        adapters: adapters.map(a => ({ name: a.name, displayName: a.displayName, icon: a.icon })),
      })),
    });
  });

  return router;
}
