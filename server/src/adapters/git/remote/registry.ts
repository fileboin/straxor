import type { GitRemoteAdapter, GitPlatformId } from "./adapter.js";
import { createGitHubAdapter } from "./providers/github.js";
import { createGitLabAdapter } from "./providers/gitlab.js";
import { createForgejoAdapter } from "./providers/forgejo.js";
import { createGiteaAdapter } from "./providers/gitea.js";
import { createBitbucketAdapter } from "./providers/bitbucket.js";
import { createHuggingFaceAdapter } from "./providers/huggingface.js";
import { db } from "../../../db/index.js";
import { gitConnections } from "../../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "../../../lib/crypto.js";

// Platform configs cached per-user (tokens, self-hosted URLs).
// Backed by the git_connections table (encrypted at rest).
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

// Hydrate the in-memory cache from the encrypted DB rows for a user.
export async function hydrateGitRemoteConfig(userId: string): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(gitConnections)
      .where(eq(gitConnections.userId, userId));

    const map = new Map<GitPlatformId, PlatformConfig>();
    for (const row of rows) {
      const platform = row.platform as GitPlatformId;
      let token: string | undefined;
      try {
        token = decrypt(row.encryptedToken);
      } catch {
        token = undefined;
      }
      map.set(platform, {
        token: token || undefined,
        baseUrl: row.baseUrl || undefined,
      });
    }
    userConfigs.set(userId, map);
  } catch {
    // DB unavailable — fall back to whatever is in the cache (or nothing).
  }
}

// Persist config: update cache and store encrypted in DB.
export async function setGitRemoteConfig(userId: string, platform: GitPlatformId, config: PlatformConfig): Promise<void> {
  const configs = userConfigs.get(userId) || new Map();
  configs.set(platform, config);
  userConfigs.set(userId, configs);

  if (!config.token && !config.baseUrl) return;

  const existing = await db
    .select()
    .from(gitConnections)
    .where(and(eq(gitConnections.userId, userId), eq(gitConnections.platform, platform)))
    .limit(1);

  if (existing.length > 0) {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (config.token) update.encryptedToken = encrypt(config.token);
    if (config.baseUrl) update.baseUrl = config.baseUrl;
    await db
      .update(gitConnections)
      .set(update)
      .where(and(eq(gitConnections.userId, userId), eq(gitConnections.platform, platform)));
  } else if (config.token) {
    await db
      .insert(gitConnections)
      .values({ userId, platform, encryptedToken: encrypt(config.token), baseUrl: config.baseUrl || null })
      .onConflictDoNothing();
  }
}

export function getGitRemoteConfig(userId: string, platform: GitPlatformId): PlatformConfig | undefined {
  return userConfigs.get(userId)?.get(platform);
}

// Decrypted token for a platform (used by local workspace for clone/push).
export async function getGitRemoteToken(userId: string, platform: GitPlatformId): Promise<string | undefined> {
  const cached = userConfigs.get(userId)?.get(platform)?.token;
  if (cached) return cached;

  await hydrateGitRemoteConfig(userId);
  return userConfigs.get(userId)?.get(platform)?.token;
}

export type { GitRemoteAdapter, GitPlatformId, PlatformConfig };
