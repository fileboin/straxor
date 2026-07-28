import type { GitRemoteAdapter, GitPlatformId } from "./adapter.js";
import { createGitHubAdapter } from "./providers/github.js";
import { createGitLabAdapter } from "./providers/gitlab.js";
import { createForgejoAdapter } from "./providers/forgejo.js";
import { createGiteaAdapter } from "./providers/gitea.js";
import { createBitbucketAdapter } from "./providers/bitbucket.js";
import { createHuggingFaceAdapter } from "./providers/huggingface.js";

// Platform configs stored per-user (tokens, self-hosted URLs)
interface PlatformConfig {
  token?: string;
  baseUrl?: string; // for self-hosted: forgejo, gitea
}

const userConfigs = new Map<string, Map<GitPlatformId, PlatformConfig>>();

export function getGitRemoteAdapter(userId: string, platform: GitPlatformId): GitRemoteAdapter {
  const configs = userConfigs.get(userId) || new Map();
  const cfg = configs.get(platform) || {};

  switch (platform) {
    case "github":
      return createGitHubAdapter(cfg.token);
    case "gitlab":
      return createGitLabAdapter(cfg.token);
    case "forgejo":
      return createForgejoAdapter({ baseUrl: cfg.baseUrl || "https://code.forgejo.org", token: cfg.token });
    case "gitea":
      return createGiteaAdapter({ baseUrl: cfg.baseUrl || "https://try.gitea.io", token: cfg.token });
    case "bitbucket":
      return createBitbucketAdapter(cfg.token);
    case "huggingface":
      return createHuggingFaceAdapter(cfg.token);
  }
}

export function setGitRemoteConfig(userId: string, platform: GitPlatformId, config: PlatformConfig): void {
  if (!userConfigs.has(userId)) {
    userConfigs.set(userId, new Map());
  }
  userConfigs.get(userId)!.set(platform, config);
}

export function getGitRemoteConfig(userId: string, platform: GitPlatformId): PlatformConfig | undefined {
  return userConfigs.get(userId)?.get(platform);
}

export type { GitRemoteAdapter, GitPlatformId, PlatformConfig };
