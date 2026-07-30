import type { MarketplacePlugin, MarketplaceEvent, PackageManifest } from "../core/types.js";

export class PluginManager {
  private plugins = new Map<string, MarketplacePlugin>();

  register(plugin: MarketplacePlugin): void {
    this.plugins.set(plugin.name, plugin);
    plugin.init?.().catch(err => console.error(`[PluginManager] init error for ${plugin.name}:`, err));
  }

  unregister(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    plugin.destroy?.().catch(() => {});
    this.plugins.delete(name);
    return true;
  }

  get(name: string): MarketplacePlugin | undefined {
    return this.plugins.get(name);
  }

  list(): MarketplacePlugin[] {
    return Array.from(this.plugins.values());
  }

  async emitEvent(event: MarketplaceEvent): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.onEvent?.(event);
      } catch (err) {
        console.error(`[PluginManager] plugin ${plugin.name} event handler error:`, err);
      }
    }
  }

  async runBeforePublishHook(manifest: PackageManifest): Promise<PackageManifest> {
    let result = { ...manifest };
    for (const plugin of this.plugins.values()) {
      if (plugin.onBeforePublish) {
        try {
          result = await plugin.onBeforePublish(result);
        } catch (err) {
          console.error(`[PluginManager] onBeforePublish error in ${plugin.name}:`, err);
        }
      }
    }
    return result;
  }

  async runAfterInstallHook(packageId: string, userId: string): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onAfterInstall) {
        try {
          await plugin.onAfterInstall(packageId, userId);
        } catch (err) {
          console.error(`[PluginManager] onAfterInstall error in ${plugin.name}:`, err);
        }
      }
    }
  }

  count(): number { return this.plugins.size; }
}
