import { db } from "../../db/index.js";
import { repoConnections } from "../../db/schema.js";
import { and, eq } from "drizzle-orm";
import { getGitRemoteToken } from "../../adapters/git/remote/registry.js";
import type { GitPlatformId } from "../../adapters/git/remote/adapter.js";
import { ensureWorkspace, getRepoWorkspaceDir, type WorkspaceInfo } from "./workspace.js";

export type RepoSlot = "ask" | "agent";

export const DEFAULT_SLOT: RepoSlot = "agent";

export function normalizeSlot(slot?: string | null): RepoSlot {
  return slot === "ask" ? "ask" : DEFAULT_SLOT;
}

export interface SharedWorkspaceContext extends WorkspaceInfo {
  repo: string;
  branch: string;
  readOnly: boolean;
}

// One mutable clone per user/repository. Agents deliberately share it, so a
// FIFO queue prevents two write-capable turns from racing over the index or
// branch. This is not a /tmp worktree and never crosses user boundaries.
const tails = new Map<string, Promise<unknown>>();

async function resolve(userId: string, slot: RepoSlot): Promise<SharedWorkspaceContext> {
  const [repo] = await db
    .select()
    .from(repoConnections)
    .where(and(eq(repoConnections.userId, userId), eq(repoConnections.isActive, true), eq(repoConnections.slot, slot)))
    .limit(1);
  if (!repo) throw new Error("No active GitHub repository for this panel");

  const readOnly = repo.connectionType === "url";
  const token = readOnly ? undefined : await getGitRemoteToken(userId, repo.platform as GitPlatformId);
  if (!readOnly && !token) throw new Error("GitHub token missing for the active repository");

  const info = await ensureWorkspace({
    userId,
    platform: repo.platform,
    owner: repo.owner,
    name: repo.name,
    fullName: repo.fullName,
    cloneUrl: repo.cloneUrl,
    defaultBranch: repo.defaultBranch,
    token,
  });
  return { ...info, repo: repo.fullName, branch: info.branch || repo.defaultBranch, readOnly };
}

export async function withSharedWorkspace<T>(
  userId: string,
  work: (context: SharedWorkspaceContext) => Promise<T>,
  slot?: string | null,
): Promise<T> {
  const normalized = normalizeSlot(slot);
  const active = await db
    .select({ owner: repoConnections.owner, name: repoConnections.name })
    .from(repoConnections)
    .where(and(eq(repoConnections.userId, userId), eq(repoConnections.isActive, true), eq(repoConnections.slot, normalized)))
    .limit(1);
  if (!active[0]) throw new Error("No active GitHub repository for this panel");
  const key = `${userId}:${normalized}:${active[0].owner}/${active[0].name}`;
  const prior = tails.get(key) || Promise.resolve();
  const run = prior.catch(() => undefined).then(async () => work(await resolve(userId, normalized)));
  tails.set(key, run);
  try {
    return await run;
  } finally {
    if (tails.get(key) === run) tails.delete(key);
  }
}

export async function getSharedWorkspaceStatus(userId: string, slot?: string | null) {
  const normalized = normalizeSlot(slot);
  const [repo] = await db
    .select()
    .from(repoConnections)
    .where(and(eq(repoConnections.userId, userId), eq(repoConnections.isActive, true), eq(repoConnections.slot, normalized)))
    .limit(1);
  if (!repo) return { connected: false };
  return {
    connected: true,
    repo: repo.fullName,
    branch: repo.defaultBranch,
    workspace: getRepoWorkspaceDir(userId, repo.owner, repo.name),
    readOnly: repo.connectionType === "url",
    queued: Array.from(tails.keys()).some((key) => key === `${userId}:${normalized}:${repo.owner}/${repo.name}`),
  };
}
