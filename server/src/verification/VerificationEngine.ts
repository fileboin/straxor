import type { VerificationAdapter, TaskProof, SpecDefinition, EvidenceData, VerdictResult } from "./types.js";

export class VerificationEngine {
  private adapters = new Map<string, VerificationAdapter>();
  private defaultAdapterId: string;

  constructor(defaultAdapterId = "proof-loop") {
    this.defaultAdapterId = defaultAdapterId;
  }

  registerAdapter(adapter: VerificationAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  getAdapter(id?: string): VerificationAdapter {
    const adapterId = id || this.defaultAdapterId;
    const adapter = this.adapters.get(adapterId);
    if (!adapter) {
      throw new Error(`Verification adapter '${adapterId}' not found`);
    }
    return adapter;
  }

  listAdapters(): { id: string; name: string }[] {
    return Array.from(this.adapters.values()).map((a) => ({
      id: a.id,
      name: a.name,
    }));
  }

  async initTask(taskId: string, spec: SpecDefinition, adapterId?: string): Promise<TaskProof> {
    return this.getAdapter(adapterId).initTask(taskId, spec);
  }

  async collectEvidence(taskId: string, evidence: EvidenceData, adapterId?: string): Promise<TaskProof> {
    return this.getAdapter(adapterId).collectEvidence(taskId, evidence);
  }

  async generateVerdict(taskId: string, verifierSessionId: string, adapterId?: string): Promise<{ verdict: VerdictResult; problems: string }> {
    return this.getAdapter(adapterId).generateVerdict(taskId, verifierSessionId);
  }

  async getStatus(taskId: string, adapterId?: string): Promise<TaskProof | null> {
    return this.getAdapter(adapterId).getStatus(taskId);
  }

  async cancelVerification(taskId: string, adapterId?: string): Promise<void> {
    return this.getAdapter(adapterId).cancelVerification(taskId);
  }

  async applyFix(taskId: string, fixNotes: string, adapterId?: string): Promise<TaskProof> {
    return this.getAdapter(adapterId).applyFix(taskId, fixNotes);
  }

  updateVerdict(taskId: string, criteriaId: string, status: "PASS" | "FAIL" | "UNKNOWN", note: string, adapterId?: string): TaskProof {
    const adapter = this.getAdapter(adapterId);
    if (!(adapter as any).updateVerdict) {
      throw new Error("This adapter does not support incremental verdict updates");
    }
    return (adapter as any).updateVerdict(taskId, criteriaId, status, note);
  }
}
