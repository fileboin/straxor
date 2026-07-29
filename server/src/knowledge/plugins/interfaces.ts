import type { KnowledgeEvent, KnowledgeItem } from "../core/types.js";

export interface KnowledgePlugin {
  id: string;
  name: string;
  version: string;
  initialize(config: Record<string, unknown>): Promise<void>;
  destroy(): Promise<void>;

  onKnowledgeEvent?(event: KnowledgeEvent): Promise<void>;
  onSync?(projectId: string): Promise<KnowledgeItem[]>;
}

export interface PluginConfig {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface PluginManagerConfig {
  pluginsDir?: string;
  autoLoad?: boolean;
}
