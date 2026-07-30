import type { MarketplaceEvent, MarketplacePlugin, PackageManifest } from "../core/types.js";

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  hooks: string[];
}

export { MarketplacePlugin, MarketplaceEvent, PackageManifest };
