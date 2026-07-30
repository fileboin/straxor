import { db } from "../../db/index.js";
import { connectionInstances, connectionEvents } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type { ConnectionInstance, ConnectionEvent } from "../core/types.js";

export interface ConnectionStore {
  saveInstance(instance: ConnectionInstance): Promise<void>;
  updateInstance(id: string, instance: ConnectionInstance): Promise<void>;
  deleteInstance(id: string): Promise<void>;
  getInstance(id: string): Promise<ConnectionInstance | undefined>;
  listInstances(): Promise<ConnectionInstance[]>;
  saveEvent(event: ConnectionEvent): Promise<void>;
  getEvents(limit?: number): Promise<ConnectionEvent[]>;
  loadAll(): Promise<{ instances: ConnectionInstance[]; events: ConnectionEvent[] }>;
}

export class PostgresConnectionStore implements ConnectionStore {
  async saveInstance(instance: ConnectionInstance): Promise<void> {
    await db.insert(connectionInstances).values({
      id: instance.id,
      instance: instance as any,
    }).onConflictDoUpdate({
      target: connectionInstances.id,
      set: { instance: instance as any, updatedAt: new Date() },
    });
  }

  async updateInstance(id: string, instance: ConnectionInstance): Promise<void> {
    await db.update(connectionInstances)
      .set({ instance: instance as any, updatedAt: new Date() })
      .where(eq(connectionInstances.id, id));
  }

  async deleteInstance(id: string): Promise<void> {
    await db.delete(connectionInstances).where(eq(connectionInstances.id, id));
  }

  async getInstance(id: string): Promise<ConnectionInstance | undefined> {
    const rows = await db.select().from(connectionInstances).where(eq(connectionInstances.id, id)).limit(1);
    return rows.length > 0 ? (rows[0].instance as unknown as ConnectionInstance) : undefined;
  }

  async listInstances(): Promise<ConnectionInstance[]> {
    const rows = await db.select().from(connectionInstances);
    return rows.map(r => r.instance as unknown as ConnectionInstance);
  }

  async saveEvent(event: ConnectionEvent): Promise<void> {
    await db.insert(connectionEvents).values({ event: event as any });
  }

  async getEvents(limit = 50): Promise<ConnectionEvent[]> {
    const rows = await db.select().from(connectionEvents).limit(limit);
    return rows.map(r => r.event as unknown as ConnectionEvent);
  }

  async loadAll(): Promise<{ instances: ConnectionInstance[]; events: ConnectionEvent[] }> {
    const [instances, events] = await Promise.all([
      this.listInstances(),
      this.getEvents(1000),
    ]);
    return { instances, events };
  }
}
