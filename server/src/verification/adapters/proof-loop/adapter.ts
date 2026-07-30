import type { VerificationAdapter, TaskProof, SpecDefinition, EvidenceData, VerdictResult } from "../../types.js";
import type { VerificationStore } from "./PostgresVerificationStore.js";

function generateId(): string {
  return `proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const VALID_STATUSES = new Set(["PASS", "FAIL", "UNKNOWN"]);

export class ProofLoopAdapter implements VerificationAdapter {
  readonly id = "proof-loop";
  readonly name = "Proof Loop";
  private store: VerificationStore;

  constructor(store?: VerificationStore) {
    this.store = store ?? createMemoryStore();
  }

  async initTask(taskId: string, spec: SpecDefinition): Promise<TaskProof> {
    const existing = await this.store.get(taskId);
    if (existing && existing.status !== "failed") {
      throw new Error(`Task ${taskId} already exists with status ${existing.status}`);
    }

    const proof: TaskProof = {
      id: generateId(),
      sessionId: taskId,
      verifierSessionId: null,
      spec,
      status: "spec_frozen",
      evidence: null,
      verdict: null,
      problems: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.store.save(taskId, proof);
    return proof;
  }

  async collectEvidence(taskId: string, evidence: EvidenceData): Promise<TaskProof> {
    const proof = await this.store.get(taskId);
    if (!proof) throw new Error(`Task ${taskId} not found`);
    if (proof.status !== "spec_frozen" && proof.status !== "fixing") {
      throw new Error(`Cannot collect evidence in status ${proof.status}`);
    }

    proof.evidence = evidence;
    proof.status = "evidence_collected";
    proof.updatedAt = Date.now();
    await this.store.save(taskId, proof);
    return proof;
  }

  async generateVerdict(taskId: string, verifierSessionId: string): Promise<{ verdict: VerdictResult; problems: string }> {
    const proof = await this.store.get(taskId);
    if (!proof) throw new Error(`Task ${taskId} not found`);
    if (proof.status !== "evidence_collected" && proof.status !== "fixing") {
      throw new Error(`Cannot verify in status ${proof.status}`);
    }

    if (verifierSessionId === proof.sessionId) {
      throw new Error(
        "Verifier MUST be a different session from builder. " +
        "Self-verification would defeat the purpose of the Proof Loop protocol."
      );
    }

    proof.verifierSessionId = verifierSessionId;
    proof.status = "verifying";
    proof.updatedAt = Date.now();

    const spec = proof.spec;
    if (!spec) throw new Error("No spec defined for this task");

    const criteriaResults = spec.criteria.map((c) => ({
      id: c.id,
      status: "UNKNOWN" as const,
      note: "Verification session launched but not yet completed.",
    }));

    const verdict: VerdictResult = {
      overall: "UNKNOWN",
      criteria: criteriaResults,
      verifierSessionId,
      verifiedAt: Date.now(),
    };

    const hasNonPass = criteriaResults.some((c) => (c.status as string) !== "PASS");
    const problems = hasNonPass
      ? `# Problems — ${taskId}\n\nVerification in progress. Waiting for verifier session ${verifierSessionId} to complete.\n`
      : "";

    proof.verdict = verdict;
    proof.problems = problems;
    proof.updatedAt = Date.now();
    await this.store.save(taskId, proof);

    return { verdict, problems };
  }

  async getStatus(taskId: string): Promise<TaskProof | null> {
    return this.store.get(taskId);
  }

  async cancelVerification(taskId: string): Promise<void> {
    const proof = await this.store.get(taskId);
    if (!proof) throw new Error(`Task ${taskId} not found`);
    proof.status = "failed";
    proof.problems = `# Problems — ${taskId}\n\nVerification cancelled.\n`;
    proof.updatedAt = Date.now();
    await this.store.save(taskId, proof);
  }

  async applyFix(taskId: string, fixNotes: string): Promise<TaskProof> {
    const proof = await this.store.get(taskId);
    if (!proof) throw new Error(`Task ${taskId} not found`);
    if (proof.status !== "failed" && proof.status !== "verifying") {
      throw new Error(`Cannot apply fix in status ${proof.status}`);
    }

    proof.status = "fixing";
    proof.problems = fixNotes;
    proof.updatedAt = Date.now();
    await this.store.save(taskId, proof);
    return proof;
  }

  async updateVerdict(taskId: string, criteriaId: string, status: "PASS" | "FAIL" | "UNKNOWN", note: string): Promise<TaskProof> {
    const proof = await this.store.get(taskId);
    if (!proof) throw new Error(`Task ${taskId} not found`);

    if (!proof.verdict) {
      throw new Error("No verdict exists yet. Run generateVerdict first.");
    }

    const criterion = proof.verdict.criteria.find((c) => c.id === criteriaId);
    if (!criterion) throw new Error(`Criterion ${criteriaId} not found in verdict`);

    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Invalid status ${status}. Must be PASS, FAIL, or UNKNOWN.`);
    }

    criterion.status = status;
    criterion.note = note;

    const allPass = proof.verdict.criteria.every((c) => c.status === "PASS");
    const hasFail = proof.verdict.criteria.some((c) => c.status === "FAIL");

    proof.verdict.overall = allPass ? "PASS" : hasFail ? "FAIL" : "UNKNOWN";
    proof.status = allPass ? "passed" : hasFail ? "failed" : "verifying";
    proof.updatedAt = Date.now();

    if (proof.status === "failed") {
      const failedCriteria = proof.verdict.criteria
        .filter((c) => c.status !== "PASS")
        .map((c) => `## ${c.id}: ${c.status}\n\n${c.note}\n`);
      proof.problems = `# Problems — ${taskId}\n\n${failedCriteria.join("\n")}`;
    } else if (proof.status === "passed") {
      proof.problems = "";
    }

    await this.store.save(taskId, proof);
    return proof;
  }
}

function createMemoryStore(): VerificationStore {
  const mem: Record<string, TaskProof> = {};
  return {
    async save(sessionId: string, proof: TaskProof) { mem[sessionId] = proof; },
    async get(sessionId: string) { return mem[sessionId] || null; },
    async delete(sessionId: string) { delete mem[sessionId]; },
    async listAll() { return Object.entries(mem).map(([sessionId, proof]) => ({ sessionId, proof })); },
  };
}
