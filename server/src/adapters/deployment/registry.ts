import type { DeploymentProvider, DeploymentTarget } from "./types.js";
import { createVpsProvider } from "./providers/vps.js";
import { createDockerProvider } from "./providers/docker.js";
import { createCoolifyProvider } from "./providers/coolify.js";
import { createDokployProvider } from "./providers/dokploy.js";
import { createCapRoverProvider } from "./providers/caprover.js";
import { createRenderProvider } from "./providers/render.js";
import { createRailwayProvider } from "./providers/railway.js";
import { createFlyioProvider } from "./providers/flyio.js";
import { createDigitalOceanProvider } from "./providers/digitalocean.js";
import { createVercelProvider } from "./providers/vercel.js";
import { createNetlifyProvider } from "./providers/netlify.js";
import { createCloudflareProvider } from "./providers/cloudflare.js";

const PROVIDER_FACTORIES: Record<DeploymentTarget, () => DeploymentProvider> = {
  vps: createVpsProvider,
  docker: createDockerProvider,
  coolify: createCoolifyProvider,
  dokploy: createDokployProvider,
  caprover: createCapRoverProvider,
  render: createRenderProvider,
  railway: createRailwayProvider,
  flyio: createFlyioProvider,
  digitalocean: createDigitalOceanProvider,
  vercel: createVercelProvider,
  netlify: createNetlifyProvider,
  cloudflare: createCloudflareProvider,
};

const providerInstances = new Map<DeploymentTarget, DeploymentProvider>();
const userConfigs = new Map<string, Map<DeploymentTarget, Record<string, string>>>();

export function getProvider(target: DeploymentTarget): DeploymentProvider | undefined {
  if (!providerInstances.has(target)) {
    const factory = PROVIDER_FACTORIES[target];
    if (!factory) return undefined;
    providerInstances.set(target, factory());
  }
  return providerInstances.get(target);
}

export function configureProvider(userId: string, target: DeploymentTarget, config: Record<string, string>): void {
  if (!userConfigs.has(userId)) {
    userConfigs.set(userId, new Map());
  }
  userConfigs.get(userId)!.set(target, config);

  const provider = getProvider(target);
  if (provider) provider.configure(config);
}

export function getProviderConfig(userId: string, target: DeploymentTarget): Record<string, string> | undefined {
  return userConfigs.get(userId)?.get(target);
}

export function isProviderConfigured(userId: string, target: DeploymentTarget): boolean {
  const provider = getProvider(target);
  if (!provider) return false;
  const config = userConfigs.get(userId)?.get(target);
  if (config) provider.configure(config);
  return provider.isConfigured();
}

export const TARGET_META: Record<DeploymentTarget, { name: string; icon: string; color: string; configFields: { key: string; label: string; secret?: boolean }[] }> = {
  vps: { name: "VPS (SSH)", icon: "🖥", color: "blue", configFields: [
    { key: "host", label: "Host" }, { key: "port", label: "Port" }, { key: "user", label: "User" },
    { key: "key", label: "SSH Key (optional)", secret: true }, { key: "deployPath", label: "Deploy Path" },
  ]},
  docker: { name: "Docker", icon: "🐳", color: "cyan", configFields: [
    { key: "host", label: "Docker Host (optional)" }, { key: "composeFile", label: "Compose File" }, { key: "serviceName", label: "Service Name" },
  ]},
  coolify: { name: "Coolify", icon: "❄", color: "green", configFields: [
    { key: "serverUrl", label: "Server URL" }, { key: "token", label: "API Token", secret: true },
  ]},
  dokploy: { name: "Dokploy", icon: "⚓", color: "blue", configFields: [
    { key: "serverUrl", label: "Server URL" }, { key: "apiKey", label: "API Key", secret: true },
  ]},
  caprover: { name: "CapRover", icon: "⚓", color: "orange", configFields: [
    { key: "serverUrl", label: "Captain URL" }, { key: "apiKey", label: "API Key", secret: true }, { key: "appName", label: "App Name" },
  ]},
  render: { name: "Render", icon: "⚡", color: "purple", configFields: [
    { key: "token", label: "API Token", secret: true },
  ]},
  railway: { name: "Railway", icon: "🚆", color: "red", configFields: [
    { key: "token", label: "API Token", secret: true },
  ]},
  flyio: { name: "Fly.io", icon: "🪰", color: "pink", configFields: [
    { key: "token", label: "API Token", secret: true }, { key: "org", label: "Organization (optional)" },
  ]},
  digitalocean: { name: "DigitalOcean", icon: "🌊", color: "blue", configFields: [
    { key: "token", label: "API Token", secret: true },
  ]},
  vercel: { name: "Vercel", icon: "▲", color: "black", configFields: [
    { key: "token", label: "API Token", secret: true },
  ]},
  netlify: { name: "Netlify", icon: "🌐", color: "green", configFields: [
    { key: "token", label: "API Token", secret: true },
  ]},
  cloudflare: { name: "Cloudflare Pages", icon: "☁", color: "orange", configFields: [
    { key: "token", label: "API Token", secret: true }, { key: "accountId", label: "Account ID" },
  ]},
};
