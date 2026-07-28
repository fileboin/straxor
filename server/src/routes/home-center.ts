import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { userApiKeys, logs, projects, deployments, machines, sessions, userPermissions } from "../db/schema.js";
import { eq, count, desc } from "drizzle-orm";

const router = Router();

// GET /api/home-center/stats — aggregated system status
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;

    // API keys count
    const apiKeys = await db
      .select({ count: count() })
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, userId));

    // Projects count
    const projectCount = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.userId, userId));

    // Machines (VPS) count
    const machineCount = await db
      .select({ count: count() })
      .from(machines)
      .where(eq(machines.userId, userId));

    // Active machines
    const activeMachines = await db
      .select({ count: count() })
      .from(machines)
      .where(eq(machines.status, "ready"));

    // Sessions count
    const sessionCount = await db
      .select({ count: count() })
      .from(sessions)
      .where(eq(sessions.userId, userId));

    // Recent logs
    const recentLogs = await db
      .select()
      .from(logs)
      .where(eq(logs.userId, userId))
      .orderBy(desc(logs.createdAt))
      .limit(5);

    // Permissions count
    const permCount = await db
      .select({ count: count() })
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));

    // Deployments
    const deploymentCount = await db
      .select({ count: count() })
      .from(deployments);

    res.json({
      apiKeys: apiKeys[0]?.count || 0,
      projects: projectCount[0]?.count || 0,
      machines: machineCount[0]?.count || 0,
      activeMachines: activeMachines[0]?.count || 0,
      sessions: sessionCount[0]?.count || 0,
      recentLogs,
      permissions: permCount[0]?.count || 0,
      deployments: deploymentCount[0]?.count || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
