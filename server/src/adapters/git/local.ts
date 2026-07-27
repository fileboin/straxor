import type { GitAdapter, GitStatus, GitDiff, GitWorktree, GitWorktreeCreateOptions, GitMergeResult } from "./adapter.js";

export function createStubGitAdapter(): GitAdapter {
  return {
    async getStatus(_machineId: string, _worktreeId?: string): Promise<GitStatus[]> {
      return [];
    },
    async getDiff(_machineId: string, _path?: string, _worktreeId?: string): Promise<GitDiff[]> {
      return [];
    },
    async commit(_machineId: string, _message: string, _worktreeId?: string) {
      return { hash: "" };
    },
    async listBranches(_machineId: string): Promise<string[]> {
      return ["main"];
    },
    async checkout(_machineId: string, _branch: string, _worktreeId?: string): Promise<void> {
      // no-op stub
    },
    async createBranch(_machineId: string, _branch: string, _from?: string): Promise<void> {
      // no-op stub
    },

    // Worktree stubs
    async listWorktrees(_machineId: string): Promise<GitWorktree[]> {
      return [
        {
          id: "main",
          path: "/home/user/project",
          branch: "main",
          head: "HEAD",
          isMain: true,
          createdAt: new Date().toISOString(),
        },
      ];
    },
    async createWorktree(_machineId: string, options: GitWorktreeCreateOptions): Promise<GitWorktree> {
      return {
        id: options.branch,
        path: `/tmp/straxor-wt-${options.branch}-stub`,
        branch: options.branch,
        head: "HEAD",
        isMain: false,
        createdAt: new Date().toISOString(),
      };
    },
    async removeWorktree(_machineId: string, _worktreeId: string): Promise<void> {
      // no-op stub
    },
    async mergeWorktree(_machineId: string, _worktreeId: string, _targetBranch?: string): Promise<GitMergeResult> {
      return {
        success: true,
        conflicts: [],
        mergedFiles: [],
        message: "Stub merge",
      };
    },
    async getWorktreeStatus(_machineId: string, _worktreeId: string): Promise<GitStatus[]> {
      return [];
    },
    async getWorktreeDiff(_machineId: string, _worktreeId: string): Promise<GitDiff[]> {
      return [];
    },
  };
}
