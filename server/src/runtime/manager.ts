// ── Runtime Manager ──
// Handles runtime registration, switching, health monitoring, and lifecycle.

import type {
  UniversalRuntimeAdapter, RuntimeId, RuntimeDefinition,
  RuntimeHealth, RuntimeHealthStatus, RuntimeChannel,
} from "./types.js";

// ── Singleton ──

let manager: RuntimeManager | null = null;

export class RuntimeManager {
  private runtimes = new Map<RuntimeId, UniversalRuntimeAdapter>();
  private definitions = new Map<RuntimeId, RuntimeDefinition>();
  private activeRuntimeId: RuntimeId = "opencode";
  private healthCache = new Map<RuntimeId, RuntimeHealth>();
  private healthIntervals = new Map<RuntimeId, ReturnType<typeof setInterval>>();
  private listeners = new Set<(event: RuntimeManagerEvent) => void>();

  // ── Registration ──

  register(definition: RuntimeDefinition, adapter: UniversalRuntimeAdapter): void {
    this.runtimes.set(definition.id, adapter);
    this.definitions.set(definition.id, definition);
  }

  unregister(id: RuntimeId): void {
    this.runtimes.delete(id);
    this.definitions.delete(id);
    this.stopHealthCheck(id);
  }

  // ── Active Runtime ──

  setActive(id: RuntimeId): void {
    if (!this.runtimes.has(id)) throw new Error(`Runtime "${id}" not registered`);
    this.activeRuntimeId = id;
    this.emit({ type: "runtime.switched", runtimeId: id });
  }

  getActiveId(): RuntimeId {
    return this.activeRuntimeId;
  }

  getAdapter(id?: RuntimeId): UniversalRuntimeAdapter {
    const targetId = id || this.activeRuntimeId;
    const adapter = this.runtimes.get(targetId);
    if (!adapter) throw new Error(`Runtime "${targetId}" not found`);
    return adapter;
  }

  getDefinition(id: RuntimeId): RuntimeDefinition | undefined {
    return this.definitions.get(id);
  }

  listAll(): RuntimeDefinition[] {
    return Array.from(this.definitions.values());
  }

  listEnabled(): RuntimeDefinition[] {
    return this.listAll().filter((d) => d.isEnabled);
  }

  // ── Health Monitoring ──

  startHealthCheck(intervalMs: number = 30_000): void {
    for (const [id, adapter] of this.runtimes) {
      this.startHealthCheckFor(id, adapter, intervalMs);
    }
  }

  stopAllHealthChecks(): void {
    for (const id of this.runtimes.keys()) {
      this.stopHealthCheck(id);
    }
  }

  private startHealthCheckFor(
    id: RuntimeId,
    adapter: UniversalRuntimeAdapter,
    intervalMs: number
  ): void {
    this.stopHealthCheck(id);

    // Initial check
    this.checkHealthFor(id, adapter);

    // Periodic
    const interval = setInterval(() => {
      this.checkHealthFor(id, adapter);
    }, intervalMs);
    this.healthIntervals.set(id, interval);
  }

  private stopHealthCheck(id: RuntimeId): void {
    const interval = this.healthIntervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.healthIntervals.delete(id);
    }
  }

  private async checkHealthFor(id: RuntimeId, adapter: UniversalRuntimeAdapter): Promise<void> {
    try {
      // Health check requires machineId — we store the last known machineId
      // For now, skip if no machine is available
      const cached = this.healthCache.get(id);
      if (cached) {
        this.healthCache.set(id, { ...cached, lastCheck: new Date().toISOString() });
      }
    } catch {
      this.healthCache.set(id, {
        status: "down",
        running: false,
        sshConnected: false,
        port: null,
        lastCheck: new Date().toISOString(),
      });
    }
  }

  async checkHealth(machineId: string, runtimeId?: RuntimeId): Promise<RuntimeHealth> {
    const id = runtimeId || this.activeRuntimeId;
    const adapter = this.runtimes.get(id);
    if (!adapter) throw new Error(`Runtime "${id}" not found`);

    const health = await adapter.healthCheck(machineId);
    this.healthCache.set(id, health);
    this.emit({ type: "runtime.health", runtimeId: id, health });
    return health;
  }

  getCachedHealth(id: RuntimeId): RuntimeHealth | null {
    return this.healthCache.get(id) || null;
  }

  // ── Events ──

  subscribe(listener: (event: RuntimeManagerEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: RuntimeManagerEvent): void {
    for (const listener of this.listeners) {
      try { listener(event); } catch {}
    }
  }

  // ── Restart / Reconnect ──

  async restart(machineId: string, runtimeId?: RuntimeId): Promise<RuntimeHealth> {
    const id = runtimeId || this.activeRuntimeId;
    const adapter = this.runtimes.get(id);
    if (!adapter) throw new Error(`Runtime "${id}" not found`);

    const health = await adapter.restart(machineId);
    this.healthCache.set(id, health);
    this.emit({ type: "runtime.restarted", runtimeId: id, health });
    return health;
  }

  async reconnect(machineId: string, runtimeId?: RuntimeId): Promise<RuntimeHealth> {
    const id = runtimeId || this.activeRuntimeId;
    const adapter = this.runtimes.get(id);
    if (!adapter) throw new Error(`Runtime "${id}" not found`);

    const health = await adapter.reconnect(machineId);
    this.healthCache.set(id, health);
    this.emit({ type: "runtime.reconnected", runtimeId: id, health });
    return health;
  }

  async updateRuntime(
    machineId: string,
    channel: RuntimeChannel,
    version?: string,
    runtimeId?: RuntimeId
  ): Promise<RuntimeHealth> {
    const id = runtimeId || this.activeRuntimeId;
    const adapter = this.runtimes.get(id);
    if (!adapter) throw new Error(`Runtime "${id}" not found`);

    const health = await adapter.updateRuntime(machineId, channel, version);
    this.healthCache.set(id, health);

    // Update definition version
    const def = this.definitions.get(id);
    if (def && health.version) {
      def.version = health.version;
    }

    this.emit({ type: "runtime.updated", runtimeId: id, health });
    return health;
  }
}

// ── Event Types ──

export type RuntimeManagerEvent =
  | { type: "runtime.switched"; runtimeId: RuntimeId }
  | { type: "runtime.health"; runtimeId: RuntimeId; health: RuntimeHealth }
  | { type: "runtime.restarted"; runtimeId: RuntimeId; health: RuntimeHealth }
  | { type: "runtime.reconnected"; runtimeId: RuntimeId; health: RuntimeHealth }
  | { type: "runtime.updated"; runtimeId: RuntimeId; health: RuntimeHealth };

// ── Singleton accessor ──

export function getRuntimeManager(): RuntimeManager {
  if (!manager) {
    manager = new RuntimeManager();
  }
  return manager;
}
