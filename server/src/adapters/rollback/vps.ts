import type { RollbackAdapter, RestorePoint, SnapshotDiff } from "./adapter.js";

const SNAPSHOTS_DIR = ".straxor/snapshots";

export function createVPSRollbackAdapter(
  exec: (machineId: string, cmd: string) => Promise<string>
): RollbackAdapter {
  return {
    async createSnapshot(machineId, projectPath, name, description, type): Promise<RestorePoint> {
      // Ensure snapshots directory exists
      await exec(machineId, `mkdir -p ${projectPath}/${SNAPSHOTS_DIR}`);

      const timestamp = Date.now();
      const slug = name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase().slice(0, 30);
      const filename = `${type}_${slug}_${timestamp}.tar.gz`;
      const snapshotPath = `${projectPath}/${SNAPSHOTS_DIR}/${filename}`;

      // Count files and get total size (excluding .git and node_modules)
      const countOutput = await exec(
        machineId,
        `cd ${projectPath} && find . -type f -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./.straxor/snapshots/*" | wc -l`
      );
      const fileCount = parseInt(countOutput.trim(), 10) || 0;

      const sizeOutput = await exec(
        machineId,
        `cd ${projectPath} && du -sh --exclude=.git --exclude=node_modules --exclude=.straxor . 2>/dev/null | cut -f1`
      );
      const totalSize = sizeOutput.trim() || "N/A";

      // Create tarball (exclude .git, node_modules, and snapshots dir)
      await exec(
        machineId,
        `cd ${projectPath} && tar czf ${snapshotPath} --exclude='./.git' --exclude='./node_modules' --exclude='./.straxor/snapshots' .`
      );

      // Try to get current git commit
      let gitCommit: string | null = null;
      try {
        const commitOutput = await exec(machineId, `cd ${projectPath} && git rev-parse HEAD 2>/dev/null`);
        if (commitOutput && !commitOutput.includes("fatal")) {
          gitCommit = commitOutput.trim();
        }
      } catch { /* no git */ }

      return {
        id: filename,
        name,
        description,
        type,
        snapshotPath,
        gitCommit,
        fileCount,
        totalSize,
        metadata: null,
        createdAt: new Date().toISOString(),
      };
    },

    async listSnapshots(machineId, projectPath): Promise<RestorePoint[]> {
      const dir = `${projectPath}/${SNAPSHOTS_DIR}`;
      const listOutput = await exec(
        machineId,
        `ls -1 ${dir} 2>/dev/null || echo ""`
      );

      const files = listOutput.trim().split("\n").filter(Boolean);
      if (files.length === 0) return [];

      const snapshots: RestorePoint[] = [];

      for (const file of files) {
        if (!file.endsWith(".tar.gz")) continue;

        const fullPath = `${dir}/${file}`;
        const parts = file.replace(".tar.gz", "").split("_");
        const type = (parts[0] || "version") as RestorePoint["type"];

        // Get file size and date
        const statOutput = await exec(
          machineId,
          `ls -la "${fullPath}" 2>/dev/null | awk '{print $5, $6, $7, $8}'`
        );
        const [sizeBytes, ...dateParts] = statOutput.trim().split(" ");
        const dateStr = dateParts.join(" ");

        // Reconstruct name from slug
        const nameSlug = parts.slice(1, -1).join("_");
        const name = nameSlug.replace(/_/g, " ");

        // Count files in snapshot
        const countOutput = await exec(
          machineId,
          `tar tzf "${fullPath}" 2>/dev/null | grep -v '/$' | wc -l`
        );
        const fileCount = parseInt(countOutput.trim(), 10) || 0;

        snapshots.push({
          id: file,
          name: name || file,
          description: "",
          type,
          snapshotPath: fullPath,
          gitCommit: null,
          fileCount,
          totalSize: formatBytes(parseInt(sizeBytes || "0", 10)),
          metadata: null,
          createdAt: dateStr || new Date().toISOString(),
        });
      }

      return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async restoreSnapshot(machineId, projectPath, snapshotPath) {
      // Verify snapshot exists
      const exists = await exec(machineId, `test -f "${snapshotPath}" && echo "yes" || echo "no"`);
      if (!exists.trim().includes("yes")) {
        throw new Error("Snapshot not found: " + snapshotPath);
      }

      // Restore: extract tarball into project directory (overwrite existing)
      await exec(
        machineId,
        `cd ${projectPath} && tar xzf "${snapshotPath}" --overwrite`
      );

      // Count restored files
      const countOutput = await exec(
        machineId,
        `tar tzf "${snapshotPath}" 2>/dev/null | grep -v '/$' | wc -l`
      );
      const filesRestored = parseInt(countOutput.trim(), 10) || 0;

      return { success: true, filesRestored };
    },

    async deleteSnapshot(machineId, snapshotPath) {
      await exec(machineId, `rm -f "${snapshotPath}"`);
    },

    async diffSnapshot(machineId, projectPath, snapshotPath) {
      // Extract snapshot to temp dir and compare
      const tmpDir = `/tmp/straxor_diff_${Date.now()}`;
      await exec(machineId, `mkdir -p ${tmpDir}`);
      await exec(machineId, `tar xzf "${snapshotPath}" -C ${tmpDir} 2>/dev/null`);

      // Get file lists from snapshot and current project
      const snapshotFiles = await exec(
        machineId,
        `cd ${tmpDir} && find . -type f | sort`
      );
      const currentFiles = await exec(
        machineId,
        `cd ${projectPath} && find . -type f -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./.straxor/*" | sort`
      );

      const snapshotSet = new Set(snapshotFiles.trim().split("\n").filter(Boolean));
      const currentSet = new Set(currentFiles.trim().split("\n").filter(Boolean));

      const filesAdded = [...currentSet].filter((f) => !snapshotSet.has(f));
      const filesRemoved = [...snapshotSet].filter((f) => !currentSet.has(f));

      // Check modified files (common files with different content)
      const commonFiles = [...currentSet].filter((f) => snapshotSet.has(f));
      const filesModified: string[] = [];

      for (const file of commonFiles.slice(0, 100)) {
        try {
          const diff = await exec(
            machineId,
            `diff "${tmpDir}/${file}" "${projectPath}/${file}" 2>/dev/null | head -1`
          );
          if (diff && diff.startsWith("<")) {
            filesModified.push(file);
          }
        } catch { /* skip */ }
      }

      // Cleanup temp dir
      await exec(machineId, `rm -rf ${tmpDir}`);

      return {
        filesAdded,
        filesRemoved,
        filesModified,
        totalChanges: filesAdded.length + filesRemoved.length + filesModified.length,
      };
    },
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
