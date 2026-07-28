// ── STRAXOR Plugin SDK ──
// Official SDK for building custom plugins, adapters, tools, and UI extensions.

import { api } from "../lib/api.js";

// ── Types ──

export interface PluginDefinition {
  name: string;
  type: PluginType;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  configSchema?: Record<string, unknown>;
  permissions?: string[];
  entryPoint?: string;
  settings?: Record<string, unknown>;
}

export type PluginType = "adapter" | "ui" | "tool" | "integration" | "custom";

export interface AdapterDefinition {
  id: string;
  name: string;
  type: "deployment" | "infrastructure" | "git";
  version: string;
  description?: string;
  icon?: string;
  actions: string[];
  configSchema?: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: SDKContext) => Promise<unknown>;
}

export interface PanelDefinition {
  id: string;
  label: string;
  icon: string;
  component: React.ComponentType<{ onClose: () => void }>;
}

export interface TileDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  action: string;
}

export interface SDKContext {
  pluginId: string;
  pluginName: string;
  api: typeof api;
  settings: Record<string, unknown>;
  log: (...args: unknown[]) => void;
  notify: (message: string, type?: "info" | "success" | "error") => void;
  events: {
    on: (event: string, handler: EventHandler) => void;
    off: (event: string) => void;
    emit: (event: string, data?: unknown) => void;
  };
  storage: {
    get: <T>(key: string) => T | undefined;
    set: <T>(key: string, value: T) => void;
    remove: (key: string) => void;
    clear: () => void;
  };
}

export type EventHandler = (data?: unknown, ctx?: SDKContext) => void | Promise<void>;

const EVENT_NAMESPACES = [
  "app:ready",
  "app:before-unload",
  "session:start",
  "session:end",
  "session:message",
  "deploy:start",
  "deploy:complete",
  "deploy:error",
  "deploy:rollback",
  "agent:tool-call",
  "agent:tool-result",
  "agent:before-respond",
  "chat:message-sent",
  "chat:message-received",
  "file:created",
  "file:modified",
  "file:deleted",
  "git:commit",
  "git:push",
  "git:pull",
  "notification:received",
  "runtime:status-change",
  "user:login",
  "user:logout",
] as const;

export type StraxorEvent = typeof EVENT_NAMESPACES[number];

// ── SDK Implementation ──

class PluginEventBus {
  private handlers = new Map<string, EventHandler[]>();

  on(event: string, handler: EventHandler) {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  off(event: string) {
    this.handlers.delete(event);
  }

  async emit(event: string, data?: unknown) {
    const list = this.handlers.get(event);
    if (!list) return;
    for (const handler of list) {
      await handler(data);
    }
  }
}

class PluginStorage {
  private prefix: string;

  constructor(pluginId: string) {
    this.prefix = `straxor:plugin:${pluginId}:`;
  }

  get<T>(key: string): T | undefined {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw ? JSON.parse(raw) : undefined;
    } catch { return undefined; }
  }

  set<T>(key: string, value: T) {
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
  }

  remove(key: string) {
    localStorage.removeItem(this.prefix + key);
  }

  clear() {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(this.prefix));
    keys.forEach((k) => localStorage.removeItem(k));
  }
}

// ── Plugin Instance ──

class StraxorPlugin {
  public readonly id: string;
  public readonly name: string;
  public readonly type: PluginType;
  public readonly version: string;
  public readonly description?: string;
  public readonly author?: string;
  public readonly icon?: string;

  public ctx: SDKContext;
  private bus = new PluginEventBus();
  private adapters: AdapterDefinition[] = [];
  private tools: ToolDefinition[] = [];
  private panels: PanelDefinition[] = [];
  private tiles: TileDefinition[] = [];

  constructor(def: PluginDefinition) {
    this.id = def.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    this.name = def.name;
    this.type = def.type;
    this.version = def.version;
    this.description = def.description;
    this.author = def.author;
    this.icon = def.icon;

    const storage = new PluginStorage(this.id);

    this.ctx = {
      pluginId: this.id,
      pluginName: this.name,
      api,
      settings: def.settings || {},
      log: (...args) => console.log(`[${this.name}]`, ...args),
      notify: (message, type = "info") => {
        const event = new CustomEvent("straxor:notify", { detail: { message, type, plugin: this.name } });
        window.dispatchEvent(event);
      },
      events: {
        on: (event, handler) => this.bus.on(event, handler),
        off: (event) => this.bus.off(event),
        emit: (event, data) => this.bus.emit(event, data),
      },
      storage: {
        get: <T>(key: string) => storage.get<T>(key),
        set: <T>(key: string, value: T) => storage.set(key, value),
        remove: (key: string) => storage.remove(key),
        clear: () => storage.clear(),
      },
    };
  }

  // ── Adapter Registration ──

  registerAdapter(adapter: AdapterDefinition) {
    this.adapters.push(adapter);
    return this;
  }

  getAdapters(): AdapterDefinition[] {
    return [...this.adapters];
  }

  // ── Tool Registration ──

  registerTool(tool: ToolDefinition) {
    this.tools.push(tool);
    return this;
  }

  getTools(): ToolDefinition[] {
    return [...this.tools];
  }

  // ── Panel Registration ──

  registerPanel(panel: PanelDefinition) {
    this.panels.push(panel);
    return this;
  }

  getPanels(): PanelDefinition[] {
    return [...this.panels];
  }

  // ── Tile Registration ──

  registerTile(tile: TileDefinition) {
    this.tiles.push(tile);
    return this;
  }

  getTiles(): TileDefinition[] {
    return [...this.tiles];
  }

  // ── Events ──

  on(event: StraxorEvent | string, handler: EventHandler) {
    this.bus.on(event, handler);
    return this;
  }

  off(event: string) {
    this.bus.off(event);
    return this;
  }

  emit(event: string, data?: unknown) {
    this.bus.emit(event, data);
    return this;
  }

  // ── Lifecycle ──

  async activate() {
    this.ctx.log(`Plugin "${this.name}" aktiviran (v${this.version})`);

    // Dispatch registration events so the platform can pick them up
    window.dispatchEvent(new CustomEvent("straxor:plugin:activated", {
      detail: {
        pluginId: this.id,
        pluginName: this.name,
        type: this.type,
        adapters: this.adapters,
        tools: this.tools,
        panels: this.panels,
        tiles: this.tiles,
      },
    }));

    await this.bus.emit("app:ready", this.ctx);
    return this;
  }

  async deactivate() {
    this.ctx.log(`Plugin "${this.name}" deaktiviran`);
    window.dispatchEvent(new CustomEvent("straxor:plugin:deactivated", {
      detail: { pluginId: this.id },
    }));
    this.bus.handlers.clear();
    return this;
  }
}

// ── SDK Entry Points ──

export function createPlugin(def: PluginDefinition): StraxorPlugin {
  return new StraxorPlugin(def);
}

export function defineAdapter(def: AdapterDefinition): AdapterDefinition {
  return def;
}

export function defineTool(def: ToolDefinition): ToolDefinition {
  return def;
}

export function definePanel(def: PanelDefinition): PanelDefinition {
  return def;
}

export function defineTile(def: TileDefinition): TileDefinition {
  return def;
}

export const StraxorEventNames = EVENT_NAMESPACES;

export type { StraxorPlugin };

export default StraxorPlugin;
