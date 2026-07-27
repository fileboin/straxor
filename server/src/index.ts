import "dotenv/config";
import express from "express";
import cors from "cors";
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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
