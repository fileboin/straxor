export type RestorePointType = "version" | "task" | "diff" | "build" | "manual";

export interface RestorePoint {
  id: string;
  name: string;
  description: string;
  type: RestorePointType;
  snapshotPath: string;
  gitCommit: string | null;
  fileCount: number;
  totalSize: string;
  metadata: string | null;
  createdAt: string;
}

export interface SnapshotDiff {
  filesAdded: string[];
  filesRemoved: string[];
  filesModified: string[];
  totalChanges: number;
}

export interface RollbackAdapter {
  // Create a snapshot of current project state
  createSnapshot(
    machineId: string,
    projectPath: string,
    name: string,
    description: string,
    type: RestorePointType
  ): Promise<RestorePoint>;

  // List all snapshots for a project
  listSnapshots(
    machineId: string,
    projectPath: string
  ): Promise<RestorePoint[]>;

  // Restore project to a snapshot
  restoreSnapshot(
    machineId: string,
    projectPath: string,
    snapshotPath: string
  ): Promise<{ success: boolean; filesRestored: number }>;

  // Delete a snapshot
  deleteSnapshot(
    machineId: string,
    snapshotPath: string
  ): Promise<void>;

  // Diff current state against a snapshot
  diffSnapshot(
    machineId: string,
    projectPath: string,
    snapshotPath: string
  ): Promise<SnapshotDiff>;
}
