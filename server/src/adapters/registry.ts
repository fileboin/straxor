import type { RuntimeAdapter } from "./runtime/adapter.js";
import type { AIProviderAdapter } from "./ai-provider/adapter.js";
import type { GitAdapter } from "./git/adapter.js";
import type { LogAdapter } from "./log/adapter.js";
import type { DeploymentAdapter } from "./deployment/adapter.js";
import { createBoundAdapter, type BoundAdapter } from "./runtime/opencode.js";
import { createHttpAIProviderAdapter } from "./ai-provider/http.js";
import { createStubGitAdapter } from "./git/local.js";
import { createDbLogAdapter } from "./log/db.js";
import { createDbDeploymentAdapter } from "./deployment/db.js";

export interface AdapterRegistry {
  runtime: (userId: string) => BoundAdapter;
  aiProvider: AIProviderAdapter;
  git: GitAdapter;
  log: LogAdapter;
  deployment: DeploymentAdapter;
}

let registry: AdapterRegistry | null = null;

export function initAdapters(): AdapterRegistry {
  registry = {
    runtime: (userId: string) => createBoundAdapter(userId),
    aiProvider: createHttpAIProviderAdapter(),
    git: createStubGitAdapter(),
    log: createDbLogAdapter(),
    deployment: createDbDeploymentAdapter(),
  };
  return registry;
}

export function getAdapters(): AdapterRegistry {
  if (!registry) {
    registry = initAdapters();
  }
  return registry;
}
