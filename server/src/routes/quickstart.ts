import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { QUICKSTART_TEMPLATES } from "../runtime/quickstart/templates.js";
import {
  scaffoldProject,
  startDevServer,
  stopDevServer,
  getDevStatus,
} from "../runtime/quickstart/scaffolder.js";

const router = Router();

router.get("/templates", requireAuth, (_req, res) => {
  const templates = QUICKSTART_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    detailedDescription: t.detailedDescription,
    icon: t.icon,
    color: t.color,
    category: t.category,
    framework: t.framework,
    installCommand: t.installCommand,
    devCommand: t.devCommand,
    buildCommand: t.buildCommand,
    port: t.port,
    dependencies: t.dependencies,
    devDependencies: t.devDependencies,
  }));
  res.json(templates);
});

router.post("/scaffold", requireAuth, async (req, res) => {
  const { templateId, projectName, sshConfig, targetDir } = req.body;

  if (!templateId || !projectName) {
    res.status(400).json({ error: "templateId and projectName are required" });
    return;
  }

  const result = await scaffoldProject({
    templateId,
    projectName,
    sshConfig: sshConfig || req.body.sshConfig,
    targetDir,
  });

  if (!result.success) {
    res.status(500).json(result);
    return;
  }

  res.json(result);
});

router.post("/start-dev", requireAuth, async (req, res) => {
  const { projectDir, templateId, projectName, sshConfig } = req.body;

  if (!projectDir || !templateId || !projectName) {
    res.status(400).json({ error: "projectDir, templateId, and projectName are required" });
    return;
  }

  const template = QUICKSTART_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    res.status(404).json({ error: `Template "${templateId}" not found` });
    return;
  }

  const status = await startDevServer(
    sshConfig || req.body.sshConfig,
    projectDir,
    template,
    projectName
  );

  res.json(status);
});

router.post("/stop-dev", requireAuth, (req, res) => {
  const { projectDir } = req.body;
  if (!projectDir) {
    res.status(400).json({ error: "projectDir is required" });
    return;
  }

  stopDevServer(projectDir);
  res.json({ success: true });
});

router.post("/dev-status", requireAuth, (req, res) => {
  const { projectDir } = req.body;
  if (!projectDir) {
    res.status(400).json({ error: "projectDir is required" });
    return;
  }

  const status = getDevStatus(projectDir);
  res.json(status);
});

export default router;
