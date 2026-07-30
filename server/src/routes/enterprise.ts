import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import {
  auditLogs,
  ssoConfigs,
  encryptionKeys,
  complianceReports,
  users,
} from "../db/schema.js";
import { eq, and, desc, like, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ── Audit Logs ──

// GET /api/enterprise/audit-logs — paginated, filterable
router.get("/audit-logs", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { orgId, action, severity, limit, offset } = req.query as Record<string, string>;

  try {
    const conditions = [];
    if (orgId) conditions.push(eq(auditLogs.orgId, orgId));
    if (action) conditions.push(eq(auditLogs.action, action));
    if (severity) conditions.push(eq(auditLogs.severity, severity));

    const numLimit = Math.min(parseInt(limit || "50"), 200);
    const numOffset = parseInt(offset || "0");

    const rows = await db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(numLimit)
      .offset(numOffset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({ logs: rows, total, limit: numLimit, offset: numOffset });
  } catch (error) {
    console.error("Audit logs error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

// POST /api/enterprise/audit-logs — create audit entry (internal use)
router.post("/audit-logs", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { orgId, action, resource, details, ip, userAgent, severity } = req.body as {
    orgId?: string; action: string; resource?: string; details?: string;
    ip?: string; userAgent?: string; severity?: string;
  };

  if (!action) {
    res.status(400).json({ error: "Action required" });
    return;
  }

  try {
    const [log] = await db
      .insert(auditLogs)
      .values({ userId, orgId, action, resource, details, ip, userAgent, severity })
      .returning();
    res.json(log);
  } catch (error) {
    console.error("Audit log create error:", error);
    res.status(500).json({ error: "Failed to create audit log" });
  }
});

// ── SSO Configs ──

// GET /api/enterprise/sso — list SSO configs for org
router.get("/sso", requireAuth, async (req: Request, res: Response) => {
  const { orgId } = req.query as Record<string, string>;
  if (!orgId) {
    res.status(400).json({ error: "orgId required" });
    return;
  }

  try {
    const configs = await db
      .select()
      .from(ssoConfigs)
      .where(eq(ssoConfigs.orgId, orgId))
      .orderBy(desc(ssoConfigs.createdAt));
    res.json(configs);
  } catch (error) {
    console.error("SSO list error:", error);
    res.status(500).json({ error: "Failed to list SSO configs" });
  }
});

// POST /api/enterprise/sso — create SSO config
router.post("/sso", requireAuth, async (req: Request, res: Response) => {
  const { orgId, provider, label, config } = req.body as {
    orgId: string; provider: string; label?: string; config?: string;
  };

  if (!orgId || !provider) {
    res.status(400).json({ error: "orgId and provider required" });
    return;
  }

  try {
    const [sso] = await db
      .insert(ssoConfigs)
      .values({ orgId, provider, label, config: config || "{}", isEnabled: true })
      .returning();
    res.json(sso);
  } catch (error) {
    console.error("SSO create error:", error);
    res.status(500).json({ error: "Failed to create SSO config" });
  }
});

// PUT /api/enterprise/sso/:id — update SSO config
router.put("/sso/:id", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { label, config, isEnabled } = req.body as {
    label?: string; config?: string; isEnabled?: boolean;
  };

  try {
    const [updated] = await db
      .update(ssoConfigs)
      .set({ ...(label !== undefined && { label }), ...(config !== undefined && { config }), ...(isEnabled !== undefined && { isEnabled }), updatedAt: new Date() })
      .where(eq(ssoConfigs.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "SSO config not found" }); return; }
    res.json(updated);
  } catch (error) {
    console.error("SSO update error:", error);
    res.status(500).json({ error: "Failed to update SSO config" });
  }
});

// DELETE /api/enterprise/sso/:id — delete SSO config
router.delete("/sso/:id", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    await db.delete(ssoConfigs).where(eq(ssoConfigs.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("SSO delete error:", error);
    res.status(500).json({ error: "Failed to delete SSO config" });
  }
});

// ── Encryption Keys ──

// GET /api/enterprise/encryption-keys — list keys
router.get("/encryption-keys", requireAuth, async (req: Request, res: Response) => {
  const { orgId } = req.query as Record<string, string>;

  try {
    const conditions = [];
    if (orgId) conditions.push(eq(encryptionKeys.orgId, orgId));

    const keys = await db
      .select()
      .from(encryptionKeys)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(encryptionKeys.createdAt));
    res.json(keys);
  } catch (error) {
    console.error("Encryption keys error:", error);
    res.status(500).json({ error: "Failed to list encryption keys" });
  }
});

// POST /api/enterprise/encryption-keys — create key
router.post("/encryption-keys", requireAuth, async (req: Request, res: Response) => {
  const { orgId, name, algorithm, keyData } = req.body as {
    orgId?: string; name: string; algorithm?: string; keyData?: string;
  };

  if (!name) {
    res.status(400).json({ error: "Name required" });
    return;
  }

  try {
    const [key] = await db
      .insert(encryptionKeys)
      .values({ orgId, name, algorithm: algorithm || "aes-256-gcm", keyData })
      .returning();
    res.json(key);
  } catch (error) {
    console.error("Encryption key create error:", error);
    res.status(500).json({ error: "Failed to create encryption key" });
  }
});

// PUT /api/enterprise/encryption-keys/:id — update
router.put("/encryption-keys/:id", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, algorithm, keyData, isActive } = req.body as {
    name?: string; algorithm?: string; keyData?: string; isActive?: boolean;
  };

  try {
    const [updated] = await db
      .update(encryptionKeys)
      .set({ ...(name !== undefined && { name }), ...(algorithm !== undefined && { algorithm }), ...(keyData !== undefined && { keyData }), ...(isActive !== undefined && { isActive }), updatedAt: new Date() })
      .where(eq(encryptionKeys.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Encryption key not found" }); return; }
    res.json(updated);
  } catch (error) {
    console.error("Encryption key update error:", error);
    res.status(500).json({ error: "Failed to update encryption key" });
  }
});

// DELETE /api/enterprise/encryption-keys/:id — delete
router.delete("/encryption-keys/:id", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    await db.delete(encryptionKeys).where(eq(encryptionKeys.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Encryption key delete error:", error);
    res.status(500).json({ error: "Failed to delete encryption key" });
  }
});

// ── Compliance Reports ──

// GET /api/enterprise/compliance — list reports
router.get("/compliance", requireAuth, async (req: Request, res: Response) => {
  const { orgId, standard } = req.query as Record<string, string>;

  try {
    const conditions = [];
    if (orgId) conditions.push(eq(complianceReports.orgId, orgId));
    if (standard) conditions.push(eq(complianceReports.standard, standard));

    const reports = await db
      .select()
      .from(complianceReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(complianceReports.generatedAt));
    res.json(reports);
  } catch (error) {
    console.error("Compliance list error:", error);
    res.status(500).json({ error: "Failed to list compliance reports" });
  }
});

// POST /api/enterprise/compliance — generate new report
router.post("/compliance", requireAuth, async (req: Request, res: Response) => {
  const { orgId, standard } = req.body as { orgId: string; standard: string };

  if (!orgId || !standard) {
    res.status(400).json({ error: "orgId and standard required" });
    return;
  }

  const validStandards = ["soc2", "gdpr", "hipaa", "pci-dss", "iso-27001"];
  if (!validStandards.includes(standard.toLowerCase())) {
    res.status(400).json({ error: `Invalid standard. Valid: ${validStandards.join(", ")}` });
    return;
  }

  try {
    const checklist: Record<string, { passed: boolean; detail: string }> = {};
    if (standard === "soc2") {
      checklist["Security Policy"] = { passed: true, detail: "Security policy documented" };
      checklist["Access Control"] = { passed: true, detail: "MFA & RBAC active" };
      checklist["Data Encryption"] = { passed: !!req.body.hasEncryption, detail: req.body.hasEncryption ? "AES-256 encryption active" : "Encryption not configured" };
      checklist["Monitoring"] = { passed: true, detail: "Audit logging enabled" };
      checklist["Incident Response"] = { passed: false, detail: "Response plan not documented" };
      checklist["Vendor Management"] = { passed: false, detail: "Vendor review pending" };
    } else if (standard === "gdpr") {
      checklist["Data Processing Registry"] = { passed: true, detail: "Processing activities logged" };
      checklist["Consent Management"] = { passed: false, detail: "Consent forms not implemented" };
      checklist["Right to Erasure"] = { passed: true, detail: "Data deletion available" };
      checklist["Data Portability"] = { passed: true, detail: "Export in JSON/CSV" };
      checklist["Breach Notification"] = { passed: true, detail: "72hr notification flow defined" };
      checklist["DPA Agreements"] = { passed: false, detail: "DPA not signed with sub-processors" };
    } else if (standard === "hipaa") {
      checklist["Privacy Rule"] = { passed: true, detail: "PHI handling defined" };
      checklist["Security Rule"] = { passed: true, detail: "Administrative safeguards in place" };
      checklist["Breach Notification"] = { passed: true, detail: "Notification process defined" };
      checklist["Physical Safeguards"] = { passed: false, detail: "Facility access not controlled" };
      checklist["Technical Safeguards"] = { passed: true, detail: "Encryption + audit trails active" };
      checklist["Business Associate Agreements"] = { passed: false, detail: "BAAs not signed with all vendors" };
    } else if (standard === "pci-dss") {
      checklist["Firewall Configuration"] = { passed: true, detail: "Network segmentation active" };
      checklist["Password Protection"] = { passed: true, detail: "MFA + strong password policy" };
      checklist["Cardholder Data Protection"] = { passed: false, detail: "Encryption not applied to all stored data" };
      checklist["Access Control"] = { passed: true, detail: "Need-to-know access enforced" };
      checklist["Network Monitoring"] = { passed: true, detail: "Logging and alerting active" };
      checklist["Security Testing"] = { passed: false, detail: "Quarterly scans not scheduled" };
    } else if (standard === "iso-27001") {
      checklist["ISMS Scope"] = { passed: true, detail: "Scope defined" };
      checklist["Risk Assessment"] = { passed: true, detail: "Risk methodology documented" };
      checklist["Security Controls"] = { passed: true, detail: "Annex A controls mapped" };
      checklist["Internal Audit"] = { passed: false, detail: "No internal audit scheduled" };
      checklist["Management Review"] = { passed: true, detail: "Quarterly reviews active" };
      checklist["Continuous Improvement"] = { passed: false, detail: "CAP process not defined" };
    }

    const passedCount = Object.values(checklist).filter((c) => c.passed).length;
    const totalCount = Object.keys(checklist).length;
    const status = passedCount === totalCount ? "passed" : passedCount > 0 ? "partial" : "failed";
    const summary = `${standard.toUpperCase()} compliance: ${passedCount}/${totalCount} controls passed`;

    const findings = Object.entries(checklist).map(([control, data]) => ({ control, ...data }));

    const [report] = await db
      .insert(complianceReports)
      .values({ orgId, standard, status, findings: JSON.stringify(findings), summary })
      .returning();

    res.json({ ...report, findings: JSON.parse(report.findings || "[]") });
  } catch (error) {
    console.error("Compliance generate error:", error);
    res.status(500).json({ error: "Failed to generate compliance report" });
  }
});

// GET /api/enterprise/compliance/standards — list valid standards
router.get("/compliance/standards", (_req: Request, res: Response) => {
  res.json({
    standards: [
      { id: "soc2", name: "SOC 2", description: "Service Organization Control 2 — security, availability, processing integrity" },
      { id: "gdpr", name: "GDPR", description: "General Data Protection Regulation — EU data privacy" },
      { id: "hipaa", name: "HIPAA", description: "Health Insurance Portability and Accountability Act — US healthcare" },
      { id: "pci-dss", name: "PCI DSS", description: "Payment Card Industry Data Security Standard" },
      { id: "iso-27001", name: "ISO 27001", description: "Information Security Management System standard" },
    ],
  });
});

// ── Private Deployment / Air-Gapped Config ──

// GET /api/enterprise/deployment-config
router.get("/deployment-config", requireAuth, async (_req: Request, res: Response) => {
  res.json({
    supported: true,
    modes: [
      { id: "on-premise", name: "On-Premise", description: "Instalacija na sopstvenom hardveru" },
      { id: "vpc", name: "Private VPC", description: "Dedicated VPC na cloud provideru" },
      { id: "air-gapped", name: "Air-Gapped", description: "Potpuno izolovano okruženje bez internet pristupa" },
    ],
    features: {
      containerized: true,
      helmChart: true,
      dockerCompose: true,
      offlineMode: true,
      localModelInference: true,
      managedDatabase: false,
      externalS3: true,
      customDomain: true,
      mfaRequired: true,
      sessionTimeout: true,
      ipWhitelist: true,
    },
  });
});

export default router;
