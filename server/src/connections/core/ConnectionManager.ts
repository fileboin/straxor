import type { ConnectionAdapter, ConnectionInstance, ConnectionTestResult, ExecuteResult, ConnectionCategory, ConnectionEvent, ConfigField, ConnectionOperation } from "./types.js";

export class ConnectionManager {
  private adapters = new Map<string, ConnectionAdapter>();
  private instances = new Map<string, ConnectionInstance>();
  private events: ConnectionEvent[] = [];
  private listeners: Array<(event: ConnectionEvent) => void> = [];

  // ── Adapter management ──
  registerAdapter(adapter: ConnectionAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  unregisterAdapter(name: string): boolean {
    return this.adapters.delete(name);
  }

  getAdapter(name: string): ConnectionAdapter | undefined {
    return this.adapters.get(name);
  }

  listAdapters(category?: ConnectionCategory): ConnectionAdapter[] {
    const all = Array.from(this.adapters.values());
    return category ? all.filter(a => a.category === category) : all;
  }

  listAdaptersByCategory(): Record<ConnectionCategory, ConnectionAdapter[]> {
    const grouped: Record<string, ConnectionAdapter[]> = {};
    for (const adapter of this.adapters.values()) {
      if (!grouped[adapter.category]) grouped[adapter.category] = [];
      grouped[adapter.category].push(adapter);
    }
    return grouped as Record<ConnectionCategory, ConnectionAdapter[]>;
  }

  // ── Instance management ──
  createInstance(adapterName: string, name: string, config: Record<string, unknown>): ConnectionInstance {
    const adapter = this.adapters.get(adapterName);
    if (!adapter) throw new Error(`Adapter "${adapterName}" not found`);

    const instance: ConnectionInstance = {
      id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      adapterName,
      name,
      category: adapter.category,
      config,
      status: "disconnected",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.instances.set(instance.id, instance);
    this.emitEvent({ type: "connection:created", connectionId: instance.id, adapterName, timestamp: new Date().toISOString() });
    return instance;
  }

  updateInstance(id: string, updates: Partial<ConnectionInstance>): ConnectionInstance | undefined {
    const instance = this.instances.get(id);
    if (!instance) return undefined;

    Object.assign(instance, updates, { updatedAt: new Date().toISOString() });
    this.emitEvent({ type: "connection:updated", connectionId: id, adapterName: instance.adapterName, timestamp: new Date().toISOString() });
    return instance;
  }

  deleteInstance(id: string): boolean {
    const instance = this.instances.get(id);
    if (!instance) return false;

    this.instances.delete(id);
    this.emitEvent({ type: "connection:deleted", connectionId: id, adapterName: instance.adapterName, timestamp: new Date().toISOString() });
    return true;
  }

  getInstance(id: string): ConnectionInstance | undefined {
    return this.instances.get(id);
  }

  listInstances(category?: ConnectionCategory): ConnectionInstance[] {
    const all = Array.from(this.instances.values());
    return category ? all.filter(i => i.category === category) : all;
  }

  // ── Operations ──
  async testConnection(instanceId: string): Promise<ConnectionTestResult> {
    const instance = this.instances.get(instanceId);
    if (!instance) throw new Error("Connection instance not found");

    const adapter = this.adapters.get(instance.adapterName);
    if (!adapter) throw new Error(`Adapter "${instance.adapterName}" not found`);

    try {
      const result = await adapter.testConnection(instance.config);
      instance.status = result.success ? "connected" : "error";
      instance.lastTestedAt = new Date().toISOString();
      if (!result.success) instance.lastError = result.message;
      instance.updatedAt = new Date().toISOString();
      this.emitEvent({
        type: result.success ? "connection:connected" : "connection:error",
        connectionId: instanceId,
        adapterName: instance.adapterName,
        timestamp: new Date().toISOString(),
        data: { message: result.message, latency: result.latency },
      });
      return result;
    } catch (err: any) {
      instance.status = "error";
      instance.lastError = err.message;
      this.emitEvent({ type: "connection:error", connectionId: instanceId, adapterName: instance.adapterName, timestamp: new Date().toISOString(), data: { error: err.message } });
      return { success: false, latency: 0, message: err.message };
    }
  }

  async execute(instanceId: string, operation: string, payload?: unknown): Promise<ExecuteResult> {
    const instance = this.instances.get(instanceId);
    if (!instance) throw new Error("Connection instance not found");

    const adapter = this.adapters.get(instance.adapterName);
    if (!adapter) throw new Error(`Adapter "${instance.adapterName}" not found`);

    const startTime = Date.now();
    try {
      const result = await adapter.execute(operation, instance.config, payload);
      result.duration = Date.now() - startTime;
      return result;
    } catch (err: any) {
      return { success: false, error: err.message, duration: Date.now() - startTime };
    }
  }

  getOperations(adapterName: string): ConnectionOperation[] {
    const adapter = this.adapters.get(adapterName);
    if (!adapter) return [];
    return adapter.getOperations();
  }

  // ── Events ──
  onEvent(listener: (event: ConnectionEvent) => void): void {
    this.listeners.push(listener);
  }

  offEvent(listener: (event: ConnectionEvent) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  getEvents(limit = 50): ConnectionEvent[] {
    return this.events.slice(-limit);
  }

  private emitEvent(event: ConnectionEvent): void {
    this.events.push(event);
    if (this.events.length > 500) this.events.shift();
    for (const listener of this.listeners) listener(event);
  }

  // ── Stats ──
  getStats(): ConnectionStats {
    const all = Array.from(this.instances.values());
    return {
      totalAdapters: this.adapters.size,
      totalInstances: all.length,
      connected: all.filter(i => i.status === "connected").length,
      disconnected: all.filter(i => i.status === "disconnected").length,
      errors: all.filter(i => i.status === "error").length,
      byCategory: Object.fromEntries(
        Object.entries(this.listAdaptersByCategory()).map(([cat, adapters]) => [cat, adapters.length])
      ) as Record<ConnectionCategory, number>,
    };
  }
}

export interface ConnectionStats {
  totalAdapters: number;
  totalInstances: number;
  connected: number;
  disconnected: number;
  errors: number;
  byCategory: Record<ConnectionCategory, number>;
}
