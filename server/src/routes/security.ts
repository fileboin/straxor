import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";
import type { ScannerId, PackageEcosystem } from "../adapters/security-scanner/adapter.js";

const router = Router();

// GET /api/security/scanners — list all scanners and their availability
router.get("/scanners", requireAuth, async (_req, res) => {
  try {
    const registry = getAdapters().securityScanner;
    const all = registry.getAll();

    const availability = await Promise.all(
      all.map(async (s) => ({
        id: s.id,
        name: s.name,
        available: await s.isAvailable().catch(() => false),
      }))
    );

    res.json(availability);
  } catch (error) {
    console.error("Error listing scanners:", error);
    res.status(500).json({ error: "Failed to list scanners" });
  }
});

// POST /api/security/scan — run scan with specified scanners
router.post("/scan", requireAuth, async (req, res) => {
  try {
    const { ecosystem, packages, scanners, machineId } = req.body;

    if (!ecosystem || !packages || !Array.isArray(packages)) {
      return res.status(400).json({
        error: "ecosystem and packages array required",
      });
    }

    const registry = getAdapters().securityScanner;

    let result;
    if (scanners && Array.isArray(scanners) && scanners.length > 0) {
      result = await registry.scanWith(scanners as ScannerId[], {
        ecosystem: ecosystem as PackageEcosystem,
        packages,
        machineId,
      });
    } else {
      result = await registry.scanAll({
        ecosystem: ecosystem as PackageEcosystem,
        packages,
        machineId,
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Error running security scan:", error);
    res.status(500).json({ error: "Security scan failed" });
  }
});

// POST /api/security/check-before-install — pre-install check (used by agent)
router.post("/check-before-install", requireAuth, async (req, res) => {
  try {
    const { packageName, version, ecosystem, machineId } = req.body;

    if (!packageName || !ecosystem) {
      return res.status(400).json({
        error: "packageName and ecosystem required",
      });
    }

    const registry = getAdapters().securityScanner;

    const result = await registry.scanAll({
      ecosystem: ecosystem as PackageEcosystem,
      packages: [{ name: packageName, version: version || "latest" }],
      machineId,
    });

    // Return a simplified verdict
    const hasCritical = result.criticalCount > 0;
    const hasHigh = result.highCount > 0;

    res.json({
      safe: !hasCritical && !hasHigh,
      verdict: hasCritical
        ? "block"
        : hasHigh
          ? "warn"
          : "allow",
      summary: {
        critical: result.criticalCount,
        high: result.highCount,
        medium: result.mediumCount,
        low: result.lowCount,
        total: result.totalVulnerabilities,
      },
      vulnerabilities: result.allVulnerabilities,
      scannersUsed: result.results.map((r) => ({
        name: r.scannerName,
        success: r.success,
        found: r.vulnerabilities.length,
      })),
      scannedAt: result.scannedAt,
    });
  } catch (error) {
    console.error("Error checking package:", error);
    res.status(500).json({ error: "Package check failed" });
  }
});

export default router;
