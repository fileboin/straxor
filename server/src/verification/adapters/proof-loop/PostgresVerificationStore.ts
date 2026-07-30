import { db } from "../../../db/index.js";
import { verificationTasks } from "../../../db/schema.js";
import { eq } from "drizzle-orm";
import type { TaskProof } from "../../types.js";

export interface VerificationStore {
  save(sessionId: string, proof: TaskProof): Promise<void>;
  get(sessionId: string): Promise<TaskProof | null>;
  delete(sessionId: string): Promise<void>;
  listAll(): Promise<{ sessionId: string; proof: TaskProof }[]>;
}

export class PostgresVerificationStore implements VerificationStore {
  async save(sessionId: string, proof: TaskProof): Promise<void> {
    await db.insert(verificationTasks).values({
      sessionId,
      proof: proof as any,
    }).onConflictDoUpdate({
      target: verificationTasks.sessionId,
      set: { proof: proof as any, updatedAt: new Date() },
    });
  }

  async get(sessionId: string): Promise<TaskProof | null> {
    const rows = await db.select().from(verificationTasks)
      .where(eq(verificationTasks.sessionId, sessionId)).limit(1);
    return rows.length > 0 ? (rows[0].proof as unknown as TaskProof) : null;
  }

  async delete(sessionId: string): Promise<void> {
    await db.delete(verificationTasks).where(eq(verificationTasks.sessionId, sessionId));
  }

  async listAll(): Promise<{ sessionId: string; proof: TaskProof }[]> {
    const rows = await db.select().from(verificationTasks);
    return rows.map(r => ({ sessionId: r.sessionId, proof: r.proof as unknown as TaskProof }));
  }
}
