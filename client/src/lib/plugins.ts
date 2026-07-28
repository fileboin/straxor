import { api } from "./api.js";

export interface Plugin {
  id: string;
  name: string;
  type: string;
  version: string;
  description: string | null;
  author: string | null;
  icon: string | null;
  configSchema: string;
  permissions: string;
  entryPoint: string | null;
  settings: string;
  isInstalled: boolean;
  isBuiltin: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  events?: PluginEvent[];
}

export interface PluginEvent {
  id: string;
  pluginId: string;
  event: string;
  handler: string;
  createdAt: string;
}

export interface MarketplaceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface MarketplaceResponse {
  plugins: Plugin[];
  categories: MarketplaceCategory[];
}

export const pluginApi = {
  list: () => api<Plugin[]>("GET", "/api/plugins"),
  
  seed: () => api<{ message: string; plugins?: Plugin[] }>("POST", "/api/plugins/seed"),

  install: (data: {
    name: string; type: string; version?: string; description?: string;
    author?: string; icon?: string; configSchema?: string;
    permissions?: string; entryPoint?: string; settings?: string;
  }) => api<Plugin>("POST", "/api/plugins", data),

  get: (id: string) => api<Plugin & { events: PluginEvent[] }>("GET", `/api/plugins/${id}`),

  update: (id: string, data: { isEnabled?: boolean; settings?: string; config?: string }) =>
    api<Plugin>("PUT", `/api/plugins/${id}`, data),

  uninstall: (id: string) => api<{ success: boolean }>("DELETE", `/api/plugins/${id}`),

  registerEvent: (pluginId: string, event: string, handler: string) =>
    api<PluginEvent>("POST", `/api/plugins/${pluginId}/events`, { event, handler }),

  deleteEvent: (pluginId: string, eventId: string) =>
    api<{ success: boolean }>("DELETE", `/api/plugins/${pluginId}/events/${eventId}`),

  marketplace: () => api<MarketplaceResponse>("GET", "/api/plugins/browse/marketplace"),
};
