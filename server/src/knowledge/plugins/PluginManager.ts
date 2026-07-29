import type { KnowledgePlugin, PluginConfig } from "./interfaces.js";
import type { KnowledgeEvent, KnowledgeItem } from "../core/types.js";

export class PluginManager {
  private plugins = new Map<string, KnowledgePlugin>();
  private configs = new Map<string, PluginConfig>();

  register(plugin: KnowledgePlugin, config?: Partial<PluginConfig>): void {
    this.plugins.set(plugin.id, plugin);
    this.configs.set(plugin.id, {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      enabled: config?.enabled ?? true,
      config: config?.config ?? {},
    });
  }

  unregister(id: string): void {
    this.plugins.delete(id);
    this.configs.delete(id);
  }

  getPlugin(id: string): KnowledgePlugin | undefined {
    return this.plugins.get(id);
  }

  listPlugins(): PluginConfig[] {
    return Array.from(this.configs.values());
  }

  isEnabled(id: string): boolean {
    return this.configs.get(id)?.enabled ?? false;
  }

  setEnabled(id: string, enabled: boolean): void {
    const config = this.configs.get(id);
    if (config) config.enabled = enabled;
  }

  async dispatchEvent(event: KnowledgeEvent): Promise<void> {
    for (const [id, plugin] of this.plugins) {
      if (!this.isEnabled(id)) continue;
      if (plugin.onKnowledgeEvent) {
        try { await plugin.onKnowledgeEvent(event); } catch { /* ignore plugin error */ }
      }
    }
  }

  async syncAll(projectId: string): Promise<KnowledgeItem[]> {
    const results: KnowledgeItem[] = [];
    for (const [id, plugin] of this.plugins) {
      if (!this.isEnabled(id)) continue;
      if (plugin.onSync) {
        try { results.push(...await plugin.onSync(projectId)); } catch { /* ignore */ }
      }
    }
    return results;
  }

  async initializeAll(): Promise<void> {
    for (const [id, plugin] of this.plugins) {
      const config = this.configs.get(id);
      try { await plugin.initialize(config?.config ?? {}); } catch { /* ignore */ }
    }
  }

  async destroyAll(): Promise<void> {
    for (const [, plugin] of this.plugins) {
      try { await plugin.destroy(); } catch { /* ignore */ }
    }
  }
}
