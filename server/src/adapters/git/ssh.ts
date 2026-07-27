import type {
  GitAdapter,
  GitStatus,
  GitDiff,
  GitWorktree,
  GitWorktreeCreateOptions,
  GitMergeResult,
} from "./adapter.js";

// SSH-based Git adapter that runs git commands on VPS via RuntimeAdapter
export function createSshGitAdapter(
  executeCommand: (machineId: string, cmd: string) => Promise<string>
): GitAdapter {
  return {
    async getStatus(machineId: string, worktreeId?: string): Promise<GitStatus[]> {
      const cwd = worktreeId ? getWorktreePath(worktreeId) : "";
      const prefix = cwd ? `cd ${cwd} && ` : "";
      const output = await executeCommand(machineId, `${prefix}git status --porcelain 2>/dev/null || echo ""`);
      return parseStatus(output);
    },

    async getDiff(machineId: string, path?: string, worktreeId?: string): Promise<GitDiff[]> {
      const cwd = worktreeId ? getWorktreePath(worktreeId) : "";
      const prefix = cwd ? `cd ${cwd} && ` : "";
      const fileArg = path ? ` -- ${path}` : "";
      const output = await executeCommand(machineId, `${prefix}git diff${fileArg} 2>/dev/null || echo ""`);
      return parseDiff(output);
    },

    async commit(machineId: string, message: string, worktreeId?: string) {
      const cwd = worktreeId ? getWorktreePath(worktreeId) : "";
      const prefix = cwd ? `cd ${cwd} && ` : "";
      const escaped = message.replace(/"/g, '\\"');
      const output = await executeCommand(
        machineId,
        `${prefix}git add -A && git commit -m "${escaped}" --allow-empty 2>/dev/null || echo ""`
      );
      const hashMatch = output.match(/\[[\w]+\s+([a-f0-9]+)\]/);
      return { hash: hashMatch?.[1] || "" };
    },

    async listBranches(machineId: string): Promise<string[]> {
      const output = await executeCommand(
        machineId,
        'git branch --format="%(refname:short)" 2>/dev/null || echo "main"'
      );
      return output.split("\n").map((l) => l.trim()).filter(Boolean);
    },

    async checkout(machineId: string, branch: string, worktreeId?: string): Promise<void> {
      const cwd = worktreeId ? getWorktreePath(worktreeId) : "";
      const prefix = cwd ? `cd ${cwd} && ` : "";
      await executeCommand(machineId, `${prefix}git checkout ${branch} 2>/dev/null`);
    },

    async createBranch(machineId: string, branch: string, from?: string): Promise<void> {
      const fromArg = from ? ` ${from}` : "";
      await executeCommand(machineId, `git branch ${branch}${fromArg} 2>/dev/null || true`);
    },

    // ── Worktree operations ──

    async listWorktrees(machineId: string): Promise<GitWorktree[]> {
      const output = await executeCommand(
        machineId,
        'git worktree list --porcelain 2>/dev/null || echo ""'
      );
      return parseWorktrees(output);
    },

    async createWorktree(
      machineId: string,
      options: GitWorktreeCreateOptions
    ): Promise<GitWorktree> {
      const { branch, fromBranch, taskName } = options;
      const worktreePath = `/tmp/straxor-wt-${branch}-${Date.now()}`;
      const fromArg = fromBranch ? ` -b ${branch} ${fromBranch}` : ` -b ${branch}`;

      await executeCommand(
        machineId,
        `git worktree add ${worktreePath}${fromArg} 2>&1`
      );

      // Set up worktree config for agent isolation
      const shortName = taskName || branch;
      await executeCommand(
        machineId,
        `cd ${worktreePath} && git config user.name "Straxor Agent - ${shortName}" && git config user.email "agent@straxor.dev" 2>/dev/null || true`
      );

      const worktrees = await this.listWorktrees(machineId);
      return worktrees.find((w) => w.path === worktreePath) || {
        id: branch,
        path: worktreePath,
        branch,
        head: "",
        isMain: false,
        createdAt: new Date().toISOString(),
      };
    },

    async removeWorktree(machineId: string, worktreeId: string): Promise<void> {
      const worktreePath = getWorktreePath(worktreeId);
      // Discard changes first, then remove
      await executeCommand(
        machineId,
        `cd ${worktreePath} && git checkout -- . 2>/dev/null; git clean -fd 2>/dev/null; cd / && git worktree remove ${worktreePath} --force 2>/dev/null || rm -rf ${worktreePath}`
      );
    },

    async mergeWorktree(
      machineId: string,
      worktreeId: string,
      targetBranch?: string
    ): Promise<GitMergeResult> {
      const worktreePath = getWorktreePath(worktreeId);
      const target = targetBranch || "main";

      // Get the branch name of this worktree
      const branchOutput = await executeCommand(
        machineId,
        `cd ${worktreePath} && git branch --show-current 2>/dev/null`
      );
      const worktreeBranch = branchOutput.trim();

      if (!worktreeBranch) {
        return {
          success: false,
          conflicts: [],
          mergedFiles: [],
          message: "Could not determine worktree branch",
        };
      }

      // Stash any uncommitted changes in worktree
      await executeCommand(
        machineId,
        `cd ${worktreePath} && git stash 2>/dev/null || true`
      );

      // Switch to target branch and merge
      const mergeOutput = await executeCommand(
        machineId,
        `git checkout ${target} 2>/dev/null && git merge ${worktreeBranch} --no-edit 2>&1`
      );

      const hasConflicts = mergeOutput.includes("CONFLICT") || mergeOutput.includes("conflict");

      // Get merged files
      const diffOutput = await executeCommand(
        machineId,
        `git diff --name-only ${target}...${worktreeBranch} 2>/dev/null || echo ""`
      );
      const mergedFiles = diffOutput.split("\n").filter(Boolean);

      // Get conflicts if any
      const conflictsOutput = await executeCommand(
        machineId,
        `git diff --name-only --diff-filter=U 2>/dev/null || echo ""`
      );
      const conflicts = conflictsOutput.split("\n").filter(Boolean);

      if (hasConflicts) {
        // Abort merge on conflict
        await executeCommand(machineId, `git merge --abort 2>/dev/null || true`);
        return {
          success: false,
          conflicts,
          mergedFiles,
          message: `Merge conflict — ${conflicts.length} datoteke u konfliktu`,
        };
      }

      return {
        success: true,
        conflicts: [],
        mergedFiles,
        message: `Uspješno merge-ano ${mergedFiles.length} datoteka`,
      };
    },

    async getWorktreeStatus(machineId: string, worktreeId: string): Promise<GitStatus[]> {
      return this.getStatus(machineId, worktreeId);
    },

    async getWorktreeDiff(machineId: string, worktreeId: string): Promise<GitDiff[]> {
      return this.getDiff(machineId, undefined, worktreeId);
    },
  };
}

// ── Helpers ──

function getWorktreePath(worktreeId: string): string {
  return `/tmp/straxor-wt-${worktreeId}`;
}

function parseStatus(output: string): GitStatus[] {
  if (!output.trim()) return [];
  const lines = output.split("\n").filter(Boolean);
  return lines.map((line) => {
    const code = line.substring(0, 2).trim();
    const path = line.substring(3).trim();
    const statusMap: Record<string, GitStatus["status"]> = {
      M: "modified",
      A: "added",
      D: "deleted",
      "?": "untracked",
      R: "renamed",
    };
    return {
      path,
      status: statusMap[code] || "modified",
    };
  });
}

function parseDiff(output: string): GitDiff[] {
  if (!output.trim()) return [];
  const files: GitDiff[] = [];
  let current: GitDiff | null = null;

  for (const line of output.split("\n")) {
    if (line.startsWith("diff --git")) {
      const pathMatch = line.match(/b\/(.+)$/);
      if (pathMatch) {
        if (current) files.push(current);
        current = {
          path: pathMatch[1],
          additions: [],
          deletions: [],
        };
      }
    } else if (current) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        current.additions.push(line.substring(1));
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        current.deletions.push(line.substring(1));
      }
    }
  }
  if (current) files.push(current);
  return files;
}

function parseWorktrees(output: string): GitWorktree[] {
  if (!output.trim()) return [];
  const worktrees: GitWorktree[] = [];
  const blocks = output.split("\n\n");

  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    const entry: Record<string, string> = {};

    for (const line of lines) {
      const [key, ...rest] = line.split(" ");
      entry[key] = rest.join(" ");
    }

    if (entry.worktree) {
      const isMain = !!(entry.head && !entry.head.includes("straxor-wt"));
      worktrees.push({
        id: isMain ? "main" : entry.branch || entry.head?.substring(0, 8) || "unknown",
        path: entry.worktree,
        branch: entry.branch || "detached",
        head: entry.head || "",
        isMain,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return worktrees;
}
