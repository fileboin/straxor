const BASE = "/api/verification";

export type CriterionStatus = "PASS" | "FAIL" | "UNKNOWN";
export type TaskProofStatus =
  | "spec_frozen" | "building" | "evidence_collected"
  | "verifying" | "passed" | "failed" | "fixing";

export interface AcceptanceCriterion {
  id: string;
  description: string;
  verifyMethod: string;
  status: CriterionStatus;
  note?: string;
}

export interface SpecDefinition {
  taskId: string;
  title: string;
  taskStatement: string;
  criteria: AcceptanceCriterion[];
  constraints: string[];
  nonGoals: string[];
  verificationApproach: string;
  frozenAt: number;
}

export interface EvidenceData {
  summary: string;
  checks: { name: string; passed: boolean; output?: string }[];
  notes: string;
}

export interface VerdictResult {
  overall: CriterionStatus;
  criteria: { id: string; status: CriterionStatus; note: string }[];
  verifierSessionId?: string;
  verifiedAt?: number;
}

export interface TaskProof {
  id: string;
  sessionId: string;
  verifierSessionId: string | null;
  spec: SpecDefinition | null;
  status: TaskProofStatus;
  evidence: EvidenceData | null;
  verdict: VerdictResult | null;
  problems: string;
  createdAt: number;
  updatedAt: number;
}

export const STATUS_LABELS: Record<TaskProofStatus, string> = {
  spec_frozen: "Spec Frozen",
  building: "Building",
  evidence_collected: "Evidence Collected",
  verifying: "Verifying",
  passed: "PASSED",
  failed: "FAILED",
  fixing: "Fixing",
};

export const STATUS_COLORS: Record<TaskProofStatus, string> = {
  spec_frozen: "text-blue-500",
  building: "text-yellow-500",
  evidence_collected: "text-yellow-500",
  verifying: "text-purple-500",
  passed: "text-green-500",
  failed: "text-red-500",
  fixing: "text-orange-500",
};

export async function freezeSpec(
  sessionId: string,
  spec: {
    title?: string;
    taskStatement?: string;
    criteria: { id: string; description: string; verifyMethod: string }[];
    constraints?: string[];
    nonGoals?: string[];
    verificationApproach?: string;
  }
): Promise<TaskProof> {
  const res = await fetch(`${BASE}/${encodeURIComponent(sessionId)}/spec`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(spec),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to freeze spec");
  }
  return res.json();
}

export async function submitEvidence(
  sessionId: string,
  evidence: EvidenceData
): Promise<TaskProof> {
  const res = await fetch(`${BASE}/${encodeURIComponent(sessionId)}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(evidence),
  });
  if (!res.ok) throw new Error("Failed to submit evidence");
  return res.json();
}

export async function verifyTask(
  sessionId: string,
  verifierSessionId: string
): Promise<{ verdict: VerdictResult; problems: string }> {
  const res = await fetch(`${BASE}/${encodeURIComponent(sessionId)}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ verifierSessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.detail || "Failed to launch verification");
  }
  return res.json();
}

export async function getTaskStatus(sessionId: string): Promise<TaskProof> {
  const res = await fetch(`${BASE}/${encodeURIComponent(sessionId)}/status`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to get status");
  return res.json();
}

export async function applyFix(
  sessionId: string,
  fixNotes: string
): Promise<TaskProof> {
  const res = await fetch(`${BASE}/${encodeURIComponent(sessionId)}/fix`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ fixNotes }),
  });
  if (!res.ok) throw new Error("Failed to apply fix");
  return res.json();
}

export async function cancelVerification(sessionId: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(sessionId)}/cancel`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to cancel verification");
}

export async function updateVerdict(
  sessionId: string,
  criterionId: string,
  status: CriterionStatus,
  note: string
): Promise<TaskProof> {
  const res = await fetch(
    `${BASE}/${encodeURIComponent(sessionId)}/verdict/${encodeURIComponent(criterionId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status, note }),
    }
  );
  if (!res.ok) throw new Error("Failed to update verdict");
  return res.json();
}
