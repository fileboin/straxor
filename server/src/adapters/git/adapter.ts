export interface GitStatus {
  path: string;
  status: "modified" | "added" | "deleted" | "untracked" | "renamed";
}

export interface GitDiff {
  path: string;
  additions: string[];
  deletions: string[];
}

export interface GitWorktree {
  id: string;
  path: string;
  branch: string;
  head: string;
  isMain: boolean;
  createdAt: string;
}

export interface GitWorktreeCreateOptions {
  branch: string;
  fromBranch?: string;
  taskName?: string;
}

export interface GitMergeResult {
  success: boolean;
  conflicts: string[];
  mergedFiles: string[];
  message: string;
}

export interface GitAdapter {
  getStatus(machineId: string, worktreeId?: string): Promise<GitStatus[]>;
  getDiff(machineId: string, path?: string, worktreeId?: string): Promise<GitDiff[]>;
  commit(machineId: string, message: string, worktreeId?: string): Promise<{ hash: string }>;
  listBranches(machineId: string): Promise<string[]>;
  checkout(machineId: string, branch: string, worktreeId?: string): Promise<void>;
  createBranch(machineId: string, branch: string, from?: string): Promise<void>;

  // Worktree operations
  listWorktrees(machineId: string): Promise<GitWorktree[]>;
  createWorktree(machineId: string, options: GitWorktreeCreateOptions): Promise<GitWorktree>;
  removeWorktree(machineId: string, worktreeId: string): Promise<void>;
  mergeWorktree(machineId: string, worktreeId: string, targetBranch?: string): Promise<GitMergeResult>;
  getWorktreeStatus(machineId: string, worktreeId: string): Promise<GitStatus[]>;
  getWorktreeDiff(machineId: string, worktreeId: string): Promise<GitDiff[]>;
}
