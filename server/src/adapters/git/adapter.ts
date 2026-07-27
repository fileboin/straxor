export interface GitStatus {
  path: string;
  status: "modified" | "added" | "deleted" | "untracked" | "renamed";
}

export interface GitDiff {
  path: string;
  additions: string[];
  deletions: string[];
}

export interface GitAdapter {
  getStatus(machineId: string): Promise<GitStatus[]>;
  getDiff(machineId: string, path?: string): Promise<GitDiff[]>;
  commit(machineId: string, message: string): Promise<{ hash: string }>;
  listBranches(machineId: string): Promise<string[]>;
  checkout(machineId: string, branch: string): Promise<void>;
}
