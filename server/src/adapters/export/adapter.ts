export type ExportFormat = "zip";
export type ExportScope = "source" | "assets" | "config" | "docs" | "all";

export interface ExportOptions {
  format: ExportFormat;
  scopes: ExportScope[];
  projectId: string;
  machineId?: string;
  branch?: string;
  includeNodeModules?: boolean;
  includeGitHistory?: boolean;
}

export interface ExportManifest {
  projectName: string;
  exportedAt: string;
  scopes: ExportScope[];
  files: ExportFileEntry[];
  totalSize: number;
  totalFiles: number;
}

export interface ExportFileEntry {
  path: string;
  size: number;
  scope: ExportScope;
}

export interface ExportResult {
  success: boolean;
  manifest: ExportManifest;
  downloadUrl: string;
  fileSize: number;
  error?: string;
}

export interface ExportAdapter {
  export(options: ExportOptions): Promise<ExportResult>;
  getManifest(options: ExportOptions): Promise<ExportManifest>;
}
