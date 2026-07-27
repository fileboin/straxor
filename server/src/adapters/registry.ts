import type { RuntimeAdapter } from "./runtime/adapter.js";
import type { AIProviderAdapter } from "./ai-provider/adapter.js";
import type { GitAdapter } from "./git/adapter.js";
import type { LogAdapter } from "./log/adapter.js";
import type { DeploymentAdapter } from "./deployment/adapter.js";
import type { ScannerRegistry } from "./security-scanner/registry.js";
import type { ExportAdapter } from "./export/adapter.js";
import type { NotificationRegistry } from "./notification/registry.js";
import type { SearchAdapter } from "./search/adapter.js";
import { createBoundAdapter, type BoundAdapter } from "./runtime/opencode.js";
import { createHttpAIProviderAdapter } from "./ai-provider/http.js";
import { createStubGitAdapter } from "./git/local.js";
import { createDbLogAdapter } from "./log/db.js";
import { createDbDeploymentAdapter } from "./deployment/db.js";
import { createScannerRegistry } from "./security-scanner/registry.js";
import { createZipExportAdapter } from "./export/zip.js";
import { createNotificationRegistry } from "./notification/registry.js";
import { createSSHSearchAdapter } from "./search/ssh.js";

export interface AdapterRegistry {
  runtime: (userId: string) => BoundAdapter;
  aiProvider: AIProviderAdapter;
  git: GitAdapter;
  log: LogAdapter;
  deployment: DeploymentAdapter;
  securityScanner: ScannerRegistry;
  export: ExportAdapter;
  notification: NotificationRegistry;
  search: (userId: string) => SearchAdapter;
}

let registry: AdapterRegistry | null = null;

export function initAdapters(): AdapterRegistry {
  registry = {
    runtime: (userId: string) => createBoundAdapter(userId),
    aiProvider: createHttpAIProviderAdapter(),
    git: createStubGitAdapter(),
    log: createDbLogAdapter(),
    deployment: createDbDeploymentAdapter(),
    securityScanner: createScannerRegistry(),
    export: createZipExportAdapter(),
    notification: createNotificationRegistry(),
    search: (userId: string) => {
      const runtime = createBoundAdapter(userId);
      return createSSHSearchAdapter((machineId, cmd) => runtime.executeCommand(machineId, cmd));
    },
  };
  return registry;
}

export function getAdapters(): AdapterRegistry {
  if (!registry) {
    registry = initAdapters();
  }
  return registry;
}
