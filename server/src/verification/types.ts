export type TaskProofStatus =
  | "spec_frozen"
  | "building"
  | "evidence_collected"
  | "verifying"
  | "passed"
  | "failed"
  | "fixing";

export type CriterionStatus = "PASS" | "FAIL" | "UNKNOWN";

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

export interface VerificationAdapter {
  readonly id: string;
  readonly name: string;

  initTask(taskId: string, spec: SpecDefinition): Promise<TaskProof>;
  collectEvidence(taskId: string, evidence: EvidenceData): Promise<TaskProof>;
  generateVerdict(taskId: string, verifierSessionId: string): Promise<{ verdict: VerdictResult; problems: string }>;
  getStatus(taskId: string): Promise<TaskProof | null>;
  cancelVerification(taskId: string): Promise<void>;
  applyFix(taskId: string, fixNotes: string): Promise<TaskProof>;
}
