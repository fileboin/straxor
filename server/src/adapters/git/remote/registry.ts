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

// Multi-slot token storage per user, per platform.
// Backed by the git_connections table (encrypted at rest). Each user can have
// several named token slots per platform; exactly one is "default" and is the
// one used for clone/push operations.
export interface GitTokenSlot {
  id: string;
  platform: GitPlatformId;
  name: string;
  username?: string | null;
  baseUrl?: string | null;
  isDefault: boolean;
  token?: string; // only present in-memory, never returned by the API
}

// userTokenSlots: Map<userId, GitTokenSlot[]>  (all platforms, filtered at use)
const userTokenSlots = new Map<string, GitTokenSlot[]>();

// ── Adapter creation ──

export function getGitRemoteAdapter(userId: string, platform: GitPlatformId): GitRemoteAdapter {
  const active = getActiveSlot(userId, platform);
  const token = active?.token;

  switch (platform) {
    case "github":
      return createGitHubAdapter(token);
    case "gitlab":
      return createGitLabAdapter(token);
    case "forgejo":
      return createForgejoAdapter({ baseUrl: active?.baseUrl || "https://code.forgejo.org", token });
    case "gitea":
      return createGiteaAdapter({ baseUrl: active?.baseUrl || "https://try.gitea.io", token });
    case "bitbucket":
      return createBitbucketAdapter(token);
    case "huggingface":
      return createHuggingFaceAdapter(token);
  }
}

// Build an adapter for a specific slot (used for validation of a newly-entered token).
export function getGitAdapterForSlot(userId: string, platform: GitPlatformId, slot: GitTokenSlot): GitRemoteAdapter {
  switch (platform) {
    case "github":
      return createGitHubAdapter(slot.token);
    case "gitlab":
      return createGitLabAdapter(slot.token);
    case "forgejo":
      return createForgejoAdapter({ baseUrl: slot.baseUrl || "https://code.forgejo.org", token: slot.token });
    case "gitea":
      return createGiteaAdapter({ baseUrl: slot.baseUrl || "https://try.gitea.io", token: slot.token });
    case "bitbucket":
      return createBitbucketAdapter(slot.token);
    case "huggingface":
      return createHuggingFaceAdapter(slot.token);
  }
}

// ── Hydration / cache ──

function slotsFor(userId: string, platform: GitPlatformId): GitTokenSlot[] {
  return (userTokenSlots.get(userId) || []).filter((s) => s.platform === platform);
}

// Hydrate the in-memory cache from the encrypted DB rows for a user.
export async function hydrateGitRemoteConfig(userId: string): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(gitConnections)
      .where(eq(gitConnections.userId, userId));

    const slots: GitTokenSlot[] = [];
    for (const row of rows) {
      let token: string | undefined;
      try {
        token = decrypt(row.encryptedToken);
      } catch {
        token = undefined;
      }
      slots.push({
        id: row.id,
        platform: row.platform as GitPlatformId,
        name: row.name,
        username: row.username,
        baseUrl: row.baseUrl,
        isDefault: row.isDefault,
        token,
      });
    }
    userTokenSlots.set(userId, slots);
  } catch {
    // DB unavailable — fall back to whatever is in the cache (or nothing).
  }
}

// ── Slot queries ──

export function getActiveSlot(userId: string, platform: GitPlatformId): GitTokenSlot | undefined {
  const slots = slotsFor(userId, platform);
  return slots.find((s) => s.isDefault) || slots[0];
}

export function getGitRemoteConfig(userId: string, platform: GitPlatformId): { token?: string; baseUrl?: string } | undefined {
  const active = getActiveSlot(userId, platform);
  return active
    ? { token: active.token, baseUrl: active.baseUrl || undefined }
    : undefined;
}

export async function listGitTokens(userId: string, platform: GitPlatformId): Promise<Omit<GitTokenSlot, "token">[]> {
  const slots = slotsFor(userId, platform);
  return slots.map(({ token: _token, ...rest }) => rest);
}

export async function getGitTokenById(userId: string, tokenId: string): Promise<GitTokenSlot | undefined> {
  return (userTokenSlots.get(userId) || []).find((s) => s.id === tokenId);
}

// Decrypted token for the active slot of a platform (used by local workspace for clone/push).
export async function getGitRemoteToken(userId: string, platform: GitPlatformId): Promise<string | undefined> {
  const cached = getActiveSlot(userId, platform)?.token;
  if (cached) return cached;

  await hydrateGitRemoteConfig(userId);
  return getActiveSlot(userId, platform)?.token;
}

// ── Mutations ──

async function refresh(userId: string): Promise<void> {
  await hydrateGitRemoteConfig(userId);
}

// Legacy single-token upsert (used by GitRemotePanel): updates the default slot,
// or creates a new default slot if none exists.
export async function setGitRemoteConfig(userId: string, platform: GitPlatformId, config: { token?: string; baseUrl?: string }): Promise<void> {
  const slots = slotsFor(userId, platform);
  const active = slots.find((s) => s.isDefault) || slots[0];

  if (active) {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (config.token) update.encryptedToken = encrypt(config.token);
    if (config.baseUrl) update.baseUrl = config.baseUrl;
    await db
      .update(gitConnections)
      .set(update)
      .where(eq(gitConnections.id, active.id));
    await refresh(userId);
    return;
  }

  if (!config.token) return;
  await db
    .insert(gitConnections)
    .values({
      userId,
      platform,
      name: "GitHub",
      username: null,
      isDefault: true,
      encryptedToken: encrypt(config.token),
      baseUrl: config.baseUrl || null,
    })
    .onConflictDoNothing();
  await refresh(userId);
}

export interface AddGitTokenInput {
  name: string;
  token: string;
  baseUrl?: string;
  username?: string | null;
}

export async function addGitToken(userId: string, platform: GitPlatformId, input: AddGitTokenInput): Promise<GitTokenSlot> {
  const slots = slotsFor(userId, platform);
  const isFirst = slots.length === 0;

  const [row] = await db
    .insert(gitConnections)
    .values({
      userId,
      platform,
      name: input.name || "GitHub",
      username: input.username || null,
      isDefault: isFirst,
      encryptedToken: encrypt(input.token),
      baseUrl: input.baseUrl || null,
    })
    .returning();

  await refresh(userId);
  return (await getGitTokenById(userId, row.id))!;
}

export async function renameGitToken(userId: string, tokenId: string, name: string): Promise<void> {
  await db
    .update(gitConnections)
    .set({ name, updatedAt: new Date() })
    .where(eq(gitConnections.id, tokenId));
  await refresh(userId);
}

export async function setUsernameGitToken(userId: string, tokenId: string, username: string | null): Promise<void> {
  await db
    .update(gitConnections)
    .set({ username, updatedAt: new Date() })
    .where(eq(gitConnections.id, tokenId));
  await refresh(userId);
}

export async function activateGitToken(userId: string, tokenId: string, platform: GitPlatformId): Promise<void> {
  await db
    .update(gitConnections)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(eq(gitConnections.userId, userId), eq(gitConnections.platform, platform)));
  await db
    .update(gitConnections)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(gitConnections.id, tokenId));
  await refresh(userId);
}

export async function deleteGitToken(userId: string, tokenId: string, platform: GitPlatformId): Promise<void> {
  const target = await getGitTokenById(userId, tokenId);
  const wasDefault = target?.isDefault;

  await db
    .delete(gitConnections)
    .where(eq(gitConnections.id, tokenId));
  await refresh(userId);

  if (wasDefault) {
    const remaining = slotsFor(userId, platform);
    const next = remaining[0];
    if (next) {
      await db
        .update(gitConnections)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(gitConnections.id, next.id));
      await refresh(userId);
    }
  }
}

export type { GitRemoteAdapter, GitPlatformId } from "./adapter.js";
