import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import {
  runtimeNodes,
  loadBalancerConfigs,
  failoverConfigs,
  scalingPolicies,
} from "../db/schema.js";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ── Cluster Status ──

router.get("/status", requireAuth, async (_req: Request, res: Response) => {
  try {
    const nodes = await db.select().from(runtimeNodes).orderBy(desc(runtimeNodes.priority));
    const lbConfigs = await db.select().from(loadBalancerConfigs);
    const failoverConfigsList = await db.select().from(failoverConfigs);
    const policies = await db.select().from(scalingPolicies);

    const onlineNodes = nodes.filter((n) => n.status === "online").length;
    const totalNodes = nodes.length;
    const activeLb = lbConfigs.filter((l) => l.isActive).length;
    const activeFailover = failoverConfigsList.filter((f) => f.isActive).length;
    const activePolicies = policies.filter((p) => p.isActive).length;

    res.json({
      nodes: { total: totalNodes, online: onlineNodes, offline: totalNodes - onlineNodes, list: nodes },
      loadBalancers: { total: lbConfigs.length, active: activeLb, list: lbConfigs },
      failover: { total: failoverConfigsList.length, active: activeFailover, list: failoverConfigsList },
      scalingPolicies: { total: policies.length, active: activePolicies, list: policies },
      health: onlineNodes === totalNodes ? "healthy" : totalNodes === 0 ? "unknown" : "degraded",
    });
  } catch (error) {
    console.error("Scale status error:", error);
    res.status(500).json({ error: "Failed to get cluster status" });
  }
});

// ── Runtime Nodes ──

router.get("/nodes", requireAuth, async (_req: Request, res: Response) => {
  try {
    const nodes = await db.select().from(runtimeNodes).orderBy(desc(runtimeNodes.priority));
    res.json(nodes);
  } catch (error) {
    console.error("Nodes list error:", error);
    res.status(500).json({ error: "Failed to list nodes" });
  }
});

router.post("/nodes", requireAuth, async (req: Request, res: Response) => {
  const { name, url, region, capabilities, version, config, priority } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }

  try {
    const [node] = await db
      .insert(runtimeNodes)
      .values({ name, url, region, capabilities: capabilities ? JSON.stringify(capabilities) : "[]", version, config: config || "{}", priority: priority || 0, status: "offline" })
      .returning();
    res.json(node);
  } catch (error) {
    console.error("Node create error:", error);
    res.status(500).json({ error: "Failed to create node" });
  }
});

router.put("/nodes/:id", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, url, status, region, capabilities, version, config, priority } = req.body;

  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (url !== undefined) updateData.url = url;
    if (status !== undefined) updateData.status = status;
    if (region !== undefined) updateData.region = region;
    if (capabilities !== undefined) updateData.capabilities = JSON.stringify(capabilities);
    if (version !== undefined) updateData.version = version;
    if (config !== undefined) updateData.config = typeof config === "string" ? config : JSON.stringify(config);
    if (priority !== undefined) updateData.priority = priority;

    const [updated] = await db.update(runtimeNodes).set(updateData).where(eq(runtimeNodes.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Node not found" }); return; }
    res.json(updated);
  } catch (error) {
    console.error("Node update error:", error);
    res.status(500).json({ error: "Failed to update node" });
  }
});

router.delete("/nodes/:id", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    await db.delete(runtimeNodes).where(eq(runtimeNodes.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Node delete error:", error);
    res.status(500).json({ error: "Failed to delete node" });
  }
});

router.post("/nodes/:id/heartbeat", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    const [node] = await db
      .update(runtimeNodes)
      .set({ status: "online", lastHeartbeat: new Date(), updatedAt: new Date() })
      .where(eq(runtimeNodes.id, id))
      .returning();
    if (!node) { res.status(404).json({ error: "Node not found" }); return; }
    res.json({ success: true, node });
  } catch (error) {
    console.error("Heartbeat error:", error);
    res.status(500).json({ error: "Failed to record heartbeat" });
  }
});

// ── Load Balancer ──

router.get("/load-balancers", requireAuth, async (_req: Request, res: Response) => {
  try {
    const configs = await db.select().from(loadBalancerConfigs).orderBy(desc(loadBalancerConfigs.createdAt));
    res.json(configs);
  } catch (error) {
    console.error("LB list error:", error);
    res.status(500).json({ error: "Failed to list load balancers" });
  }
});

router.post("/load-balancers", requireAuth, async (req: Request, res: Response) => {
  const { name, provider, strategy, targets, rules } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }

  try {
    const [lb] = await db
      .insert(loadBalancerConfigs)
      .values({ name, provider, strategy, targets: targets ? JSON.stringify(targets) : "[]", rules: rules ? JSON.stringify(rules) : "[]" })
      .returning();
    res.json(lb);
  } catch (error) {
    console.error("LB create error:", error);
    res.status(500).json({ error: "Failed to create load balancer" });
  }
});

router.put("/load-balancers/:id", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, provider, strategy, targets, rules, isActive } = req.body;

  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (provider !== undefined) updateData.provider = provider;
    if (strategy !== undefined) updateData.strategy = strategy;
    if (targets !== undefined) updateData.targets = JSON.stringify(targets);
    if (rules !== undefined) updateData.rules = JSON.stringify(rules);
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updated] = await db.update(loadBalancerConfigs).set(updateData).where(eq(loadBalancerConfigs.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Load balancer not found" }); return; }
    res.json(updated);
  } catch (error) {
    console.error("LB update error:", error);
    res.status(500).json({ error: "Failed to update load balancer" });
  }
});

router.delete("/load-balancers/:id", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    await db.delete(loadBalancerConfigs).where(eq(loadBalancerConfigs.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("LB delete error:", error);
    res.status(500).json({ error: "Failed to delete load balancer" });
  }
});

// ── Failover ──

router.get("/failover", requireAuth, async (_req: Request, res: Response) => {
  try {
    const configs = await db.select().from(failoverConfigs).orderBy(desc(failoverConfigs.createdAt));
    res.json(configs);
  } catch (error) {
    console.error("Failover list error:", error);
    res.status(500).json({ error: "Failed to list failover configs" });
  }
});

router.post("/failover", requireAuth, async (req: Request, res: Response) => {
  const { name, provider, primaryEndpoint, backupEndpoints, strategy, healthCheckInterval, maxRetries, cooldownPeriod } = req.body;
  if (!name || !provider) { res.status(400).json({ error: "name and provider required" }); return; }

  try {
    const [config] = await db
      .insert(failoverConfigs)
      .values({ name, provider, primaryEndpoint, backupEndpoints: backupEndpoints ? JSON.stringify(backupEndpoints) : "[]", strategy, healthCheckInterval, maxRetries, cooldownPeriod })
      .returning();
    res.json(config);
  } catch (error) {
    console.error("Failover create error:", error);
    res.status(500).json({ error: "Failed to create failover config" });
  }
});

router.put("/failover/:id", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, provider, primaryEndpoint, backupEndpoints, strategy, healthCheckInterval, maxRetries, cooldownPeriod, isActive } = req.body;

  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (provider !== undefined) updateData.provider = provider;
    if (primaryEndpoint !== undefined) updateData.primaryEndpoint = primaryEndpoint;
    if (backupEndpoints !== undefined) updateData.backupEndpoints = JSON.stringify(backupEndpoints);
    if (strategy !== undefined) updateData.strategy = strategy;
    if (healthCheckInterval !== undefined) updateData.healthCheckInterval = healthCheckInterval;
    if (maxRetries !== undefined) updateData.maxRetries = maxRetries;
    if (cooldownPeriod !== undefined) updateData.cooldownPeriod = cooldownPeriod;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updated] = await db.update(failoverConfigs).set(updateData).where(eq(failoverConfigs.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Failover config not found" }); return; }
    res.json(updated);
  } catch (error) {
    console.error("Failover update error:", error);
    res.status(500).json({ error: "Failed to update failover config" });
  }
});

router.delete("/failover/:id", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    await db.delete(failoverConfigs).where(eq(failoverConfigs.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Failover delete error:", error);
    res.status(500).json({ error: "Failed to delete failover config" });
  }
});

// ── Scaling Policies ──

router.get("/scaling-policies", requireAuth, async (_req: Request, res: Response) => {
  try {
    const policies = await db.select().from(scalingPolicies).orderBy(desc(scalingPolicies.createdAt));
    res.json(policies);
  } catch (error) {
    console.error("Scaling policies error:", error);
    res.status(500).json({ error: "Failed to list scaling policies" });
  }
});

router.post("/scaling-policies", requireAuth, async (req: Request, res: Response) => {
  const { name, target, metric, minInstances, maxInstances, scaleUpThreshold, scaleDownThreshold, cooldownSeconds } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }

  try {
    const [policy] = await db
      .insert(scalingPolicies)
      .values({ name, target, metric, minInstances, maxInstances, scaleUpThreshold, scaleDownThreshold, cooldownSeconds })
      .returning();
    res.json(policy);
  } catch (error) {
    console.error("Policy create error:", error);
    res.status(500).json({ error: "Failed to create scaling policy" });
  }
});

router.put("/scaling-policies/:id", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, target, metric, minInstances, maxInstances, scaleUpThreshold, scaleDownThreshold, cooldownSeconds, isActive } = req.body;

  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (target !== undefined) updateData.target = target;
    if (metric !== undefined) updateData.metric = metric;
    if (minInstances !== undefined) updateData.minInstances = minInstances;
    if (maxInstances !== undefined) updateData.maxInstances = maxInstances;
    if (scaleUpThreshold !== undefined) updateData.scaleUpThreshold = scaleUpThreshold;
    if (scaleDownThreshold !== undefined) updateData.scaleDownThreshold = scaleDownThreshold;
    if (cooldownSeconds !== undefined) updateData.cooldownSeconds = cooldownSeconds;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updated] = await db.update(scalingPolicies).set(updateData).where(eq(scalingPolicies.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Scaling policy not found" }); return; }
    res.json(updated);
  } catch (error) {
    console.error("Policy update error:", error);
    res.status(500).json({ error: "Failed to update scaling policy" });
  }
});

router.delete("/scaling-policies/:id", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    await db.delete(scalingPolicies).where(eq(scalingPolicies.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Policy delete error:", error);
    res.status(500).json({ error: "Failed to delete scaling policy" });
  }
});

// ── Simulate failover (demo/test) ──

router.post("/failover/:id/trigger", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    const [config] = await db.select().from(failoverConfigs).where(eq(failoverConfigs.id, id));
    if (!config) { res.status(404).json({ error: "Failover config not found" }); return; }

    const endpoints = JSON.parse(config.backupEndpoints || "[]");
    const activated = endpoints.length > 0 ? endpoints[0] : null;

    res.json({
      message: `Failover triggered for ${config.provider}`,
      primary: config.primaryEndpoint,
      activatedBackup: activated,
      strategy: config.strategy,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failover trigger error:", error);
    res.status(500).json({ error: "Failed to trigger failover" });
  }
});

export default router;
