import { Router } from "express";
import type { Request, Response } from "express";
import { VerificationEngine } from "../VerificationEngine.js";
import { ProofLoopAdapter } from "../adapters/proof-loop/adapter.js";

const engine = new VerificationEngine();
engine.registerAdapter(new ProofLoopAdapter());

const router = Router();

router.get("/adapters", (_req: Request, res: Response) => {
  try {
    res.json(engine.listAdapters());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Phase 0: Freeze spec
router.post("/:sessionId/spec", async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { title, taskStatement, criteria, constraints, nonGoals, verificationApproach } = req.body;

    if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
      res.status(400).json({ error: "At least one acceptance criterion is required" });
      return;
    }

    for (const c of criteria) {
      if (!c.id || !c.description || !c.verifyMethod) {
        res.status(400).json({ error: "Each criterion must have id, description, and verifyMethod" });
        return;
      }
    }

    const spec = {
      taskId: sessionId,
      title: title || `Task ${sessionId}`,
      taskStatement: taskStatement || "",
      criteria: criteria.map((c: any) => ({
        id: c.id,
        description: c.description,
        verifyMethod: c.verifyMethod,
        status: "UNKNOWN" as const,
        note: "Not verified yet.",
      })),
      constraints: constraints || [],
      nonGoals: nonGoals || [],
      verificationApproach: verificationApproach || "",
      frozenAt: Date.now(),
    };

    const proof = await engine.initTask(sessionId as string, spec);
    res.status(201).json(proof);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Phase 2: Submit evidence
router.post("/:sessionId/evidence", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { summary, checks, notes } = req.body;

    if (!summary) {
      res.status(400).json({ error: "Evidence summary is required" });
      return;
    }

    const proof = await engine.collectEvidence(sessionId as string, {
      summary,
      checks: checks || [],
      notes: notes || "",
    });

    res.json(proof);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Phase 3: Fresh verify (HARD RULE: verifier != builder)
router.post("/:sessionId/verify", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { verifierSessionId } = req.body;

    if (!verifierSessionId) {
      res.status(400).json({ error: "verifierSessionId is required" });
      return;
    }

    if (verifierSessionId === sessionId) {
      res.status(403).json({
        error: "Verifier MUST be a different session from builder.",
        detail: "Self-verification is not allowed. The session that built the code cannot also verify it. Provide a verifierSessionId from a fresh, independent agent session.",
      });
      return;
    }

    const result = await engine.generateVerdict(sessionId as string, verifierSessionId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get status
router.get("/:sessionId/status", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const proof = await engine.getStatus(sessionId as string);

    if (!proof) {
      res.status(404).json({ error: "No proof found for this session" });
      return;
    }

    res.json(proof);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Phase 4: Apply fix
router.post("/:sessionId/fix", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { fixNotes } = req.body;

    if (!fixNotes) {
      res.status(400).json({ error: "fixNotes is required" });
      return;
    }

    const proof = await engine.applyFix(sessionId as string, fixNotes);
    res.json(proof);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel verification
router.post("/:sessionId/cancel", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    await engine.cancelVerification(sessionId as string);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update individual criterion verdict (called by verifier agent)
router.patch("/:sessionId/verdict/:criterionId", async (req: Request, res: Response) => {
  try {
    const { sessionId, criterionId } = req.params;
    const { status, note } = req.body;

    if (!status || !["PASS", "FAIL", "UNKNOWN"].includes(status)) {
      res.status(400).json({ error: "status must be PASS, FAIL, or UNKNOWN" });
      return;
    }

    const proof = engine.updateVerdict(sessionId as string, criterionId as string, status, note || "");
    res.json(proof);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as verificationRoutes };
