import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { db } from "./db/index.js";
import { sql } from "drizzle-orm";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import chatRoutes from "./routes/chat.js";
import machineRoutes from "./routes/machines.js";
import apiKeyRoutes from "./routes/api-keys.js";
import agentRoutes from "./routes/agent.js";
import logRoutes from "./routes/logs.js";
import runtimeRoutes from "./routes/runtime.js";
import envRoutes from "./routes/envs.js";
import deploymentRoutes from "./routes/deployments.js";
import consoleRoutes from "./routes/console.js";
import permissionRoutes from "./routes/permissions.js";
import promptRoutes from "./routes/prompts.js";
import securityRoutes from "./routes/security.js";
import exportRoutes from "./routes/export.js";
import notificationRoutes from "./routes/notifications.js";
import worktreeRoutes from "./routes/worktrees.js";
import verifyRoutes from "./routes/verify.js";
import browserVerifyRoutes from "./routes/browser-verify.js";
import sessionRoutes from "./routes/sessions.js";
import fileRoutes from "./routes/files.js";
import searchRoutes from "./routes/search.js";
import previewRoutes from "./routes/preview.js";
import databaseRoutes from "./routes/database.js";
import rollbackRoutes from "./routes/rollback.js";
import contextRoutes from "./routes/context.js";
import gatewayRoutes from "./routes/gateway.js";
import providerRoutes from "./routes/providers.js";
import multiAgentRoutes from "./routes/multi-agent.js";
import homeCenterRoutes from "./routes/home-center.js";
import designAssetsRoutes from "./routes/design-assets.js";
import usageRoutes from "./routes/usage.js";
import runtimesRoutes from "./routes/runtimes.js";
import quickstartRoutes from "./routes/quickstart.js";
import designRoutes from "./routes/design.js";
import webResearchRoutes from "./routes/web-research.js";
import acpRoutes from "./routes/acp.js";
import gitRemoteRoutes from "./routes/git-remote.js";
import kanbanRoutes from "./routes/kanban.js";
import mcpMarketplaceRoutes from "./routes/mcp-marketplace.js";
import infrastructureRoutes from "./routes/infrastructure.js";
import teamsRoutes from "./routes/teams.js";
import collaboratorsRoutes from "./routes/collaborators.js";
import commentsRoutes from "./routes/comments.js";
import organizationRoutes from "./routes/organizations.js";
import enterpriseRoutes from "./routes/enterprise.js";
import pluginRoutes from "./routes/plugins.js";
import marketplaceRoutes from "./routes/marketplace.js";
import scaleRoutes from "./routes/scale.js";
import resilienceRoutes from "./routes/resilience.js";
import adminRoutes from "./routes/admin.js";
import supportRoutes from "./routes/support.js";
import publishRoutes from "./routes/publish.js";
import knowledgeRoutes from "./knowledge/api/routes.js";
import { default as imageRoutes } from "./image/api/routes.js";
import { createMarketplaceRouter } from "./marketplace/api/routes.js";
import { createConnectionsRouter } from "./connections/api/routes.js";
import { imageAgentRoutes } from "./agents/image-agent/api/routes.js";
import { verificationRoutes } from "./verification/api/routes.js";

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security: CORS hardening ──
// Production: set CLIENT_URL to exact origin (e.g. https://straxor.app)
// Dev fallback: localhost:5173 (Vite default)
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173").split(",").map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
}));

// ── Security: Rate limiting ──
// Auth endpoints: stricter limit (20 per 15 min per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// General API: 500 per 15 min per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

app.use(express.json({ limit: "1mb" }));

// ── Security: Input validation middleware ──
app.use((req, _res, next) => {
  // Reject requests with excessively deep nested JSON
  if (req.body && typeof req.body === "object") {
    const depth = (obj: unknown, d = 0): number => {
      if (d > 20) return d;
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        return Math.max(0, ...Object.values(obj as Record<string, unknown>).map(v => depth(v, d + 1)));
      }
      if (Array.isArray(obj)) {
        return Math.max(0, ...obj.map(v => depth(v, d + 1)));
      }
      return d;
    };
    if (depth(req.body) > 20) {
      _res.status(400).json({ error: "Request body too deeply nested" });
      return;
    }
  }
  next();
});

app.get("/api/health", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

// Apply general rate limiter to all /api routes (limits requests, not SSE duration)
app.use("/api", apiLimiter);

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/machines", machineRoutes);
app.use("/api/api-keys", apiKeyRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/runtime", runtimeRoutes);
app.use("/api/envs", envRoutes);
app.use("/api/deployments", deploymentRoutes);
app.use("/api/console", consoleRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/prompts", promptRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/worktrees", worktreeRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/browser-verify", browserVerifyRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/preview", previewRoutes);
app.use("/api/database", databaseRoutes);
app.use("/api/rollback", rollbackRoutes);
app.use("/api/context", contextRoutes);
app.use("/api/gateway", gatewayRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/multi-agent", multiAgentRoutes);
app.use("/api/home-center", homeCenterRoutes);
app.use("/api/design-assets", designAssetsRoutes);
app.use("/api/usage", usageRoutes);
app.use("/api/runtimes", runtimesRoutes);
app.use("/api/quickstart", quickstartRoutes);
app.use("/api/design", designRoutes);
app.use("/api/web-research", webResearchRoutes);
app.use("/api/acp", acpRoutes);
app.use("/api/git-remote", gitRemoteRoutes);
app.use("/api/kanban", kanbanRoutes);
app.use("/api/mcp-marketplace", mcpMarketplaceRoutes);
app.use("/api/infrastructure", infrastructureRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/projects/:projectId/collaborators", collaboratorsRoutes);
app.use("/api/projects/:projectId/comments", commentsRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/enterprise", enterpriseRoutes);
app.use("/api/plugins", pluginRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/scale", scaleRoutes);
app.use("/api/resilience", resilienceRoutes);
app.use("/api/publish", publishRoutes);
app.use("/api/knowledge", knowledgeRoutes);
app.use("/api/image", imageRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/admin", adminRoutes);

// Set up Marketplace Core (independent system)
const marketplaceRouter = createMarketplaceRouter();
app.use("/api/marketplace-core", marketplaceRouter);

const connectionsRouter = createConnectionsRouter();
app.use("/api/connections", connectionsRouter);

app.use("/api/image-agent", imageAgentRoutes);
app.use("/api/verification", verificationRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
