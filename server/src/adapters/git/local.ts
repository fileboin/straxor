import type { GitAdapter, GitStatus, GitDiff } from "./adapter.js";

export function createStubGitAdapter(): GitAdapter {
  return {
    async getStatus(_machineId: string): Promise<GitStatus[]> {
      return [];
    },
    async getDiff(_machineId: string, _path?: string): Promise<GitDiff[]> {
      return [];
    },
    async commit(_machineId: string, _message: string) {
      return { hash: "" };
    },
    async listBranches(_machineId: string): Promise<string[]> {
      return ["main"];
    },
    async checkout(_machineId: string, _branch: string): Promise<void> {
      // no-op stub
    },
  };
}
