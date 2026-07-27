import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";
import { createVerifierAdapter } from "../adapters/verifier/checks.js";
import type { VerificationRequest, CheckName } from "../adapters/verifier/adapter.js";

const router = Router();

function getVerifier(userId: string) {
  const runtime = getAdapters().runtime(userId);
  return createVerifierAdapter((machineId, cmd) =>
    runtime.executeCommand(machineId, cmd)
  );
}

// POST /api/verify — run verification checks
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, sessionId, stepId, checks, projectPath, filePatterns } =
      req.body as VerificationRequest;

    if (!machineId || !sessionId || !stepId) {
      return res
        .status(400)
        .json({ error: "machineId, sessionId, stepId required" });
    }

    const verifier = getVerifier(userId);
    const result = await verifier.verify({
      machineId,
      sessionId,
      stepId,
      checks,
      projectPath,
      filePatterns,
    });

    res.json(result);
  } catch (error) {
    console.error("Error running verification:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});

// POST /api/verify/build — run build check only
router.post("/build", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, projectPath } = req.body;
    const verifier = getVerifier(userId);
    const result = await verifier.verifyBuild(machineId, projectPath);
    res.json(result);
  } catch (error) {
    console.error("Error verifying build:", error);
    res.status(500).json({ error: "Build verification failed" });
  }
});

// POST /api/verify/tests — run tests check only
router.post("/tests", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, projectPath } = req.body;
    const verifier = getVerifier(userId);
    const result = await verifier.verifyTests(machineId, projectPath);
    res.json(result);
  } catch (error) {
    console.error("Error verifying tests:", error);
    res.status(500).json({ error: "Test verification failed" });
  }
});

export default router;
