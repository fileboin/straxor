// ── Runtime configuration ──
// Single source of truth for env-driven limits. Pure parsers are exported for
// unit tests; getConfig() reads process.env (or an injected env object).

export interface RuntimeConfig {
  workspaceRoot: string;
  maxWorkspaceSizeBytes: number;
  maxProcessTimeMs: number;
  maxPreviewStartupMs: number;
  maxPreviewTimeMs: number;
  previewBaseUrl: string;
  cleanupIntervalMs: number;
  taskWorkspaceTtlMs: number;
  maxProcessOutputBytes: number;
}

const MS = 1;
const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

export const DEFAULTS: RuntimeConfig = {
  workspaceRoot: ".straxor-workspaces",
  maxWorkspaceSizeBytes: 512 * MB,
  maxProcessTimeMs: 30 * MINUTE,
  maxPreviewStartupMs: 3 * MINUTE,
  maxPreviewTimeMs: 30 * MINUTE,
  previewBaseUrl: "http://localhost:3001",
  cleanupIntervalMs: 5 * MINUTE,
  taskWorkspaceTtlMs: 24 * HOUR,
  maxProcessOutputBytes: 4 * MB,
};

const DURATION_UNITS: Record<string, number> = {
  ms: MS,
  s: SECOND,
  sec: SECOND,
  m: MINUTE,
  min: MINUTE,
  h: HOUR,
  hr: HOUR,
  d: DAY,
};

/**
 * Parse a human duration ("30m", "3 min", "1800s", "500" ms, "1h", "2d") into
 * milliseconds. Returns `fallback` for missing/empty/malformed input.
 */
export function parseDurationMs(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(ms|min|sec|hr|s|m|h|d)?$/i);
  if (!match) return fallback;
  const amount = parseFloat(match[1]);
  const unit = (match[2] || "ms").toLowerCase();
  const multiplier = DURATION_UNITS[unit];
  if (!multiplier) return fallback;
  return Math.round(amount * multiplier);
}

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  kb: KB,
  mb: MB,
  gb: GB,
};

/**
 * Parse a human size ("512mb", "1gb", "10kb", "2048" bytes) into bytes.
 * Returns `fallback` for missing/empty/malformed input.
 */
export function parseSizeBytes(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i);
  if (!match) return fallback;
  const amount = parseFloat(match[1]);
  const unit = (match[2] || "b").toLowerCase();
  const multiplier = SIZE_UNITS[unit];
  if (!multiplier) return fallback;
  return Math.round(amount * multiplier);
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return {
    workspaceRoot: env.WORKSPACE_ROOT || env.STRAXOR_WORKSPACE_DIR || DEFAULTS.workspaceRoot,
    maxWorkspaceSizeBytes: parseSizeBytes(env.MAX_WORKSPACE_SIZE, DEFAULTS.maxWorkspaceSizeBytes),
    maxProcessTimeMs: parseDurationMs(env.MAX_PROCESS_TIME, DEFAULTS.maxProcessTimeMs),
    maxPreviewStartupMs: parseDurationMs(env.MAX_PREVIEW_STARTUP, DEFAULTS.maxPreviewStartupMs),
    maxPreviewTimeMs: parseDurationMs(env.MAX_PREVIEW_TIME, DEFAULTS.maxPreviewTimeMs),
    previewBaseUrl: env.PREVIEW_BASE_URL || DEFAULTS.previewBaseUrl,
    cleanupIntervalMs: parseDurationMs(env.CLEANUP_INTERVAL, DEFAULTS.cleanupIntervalMs),
    taskWorkspaceTtlMs: parseDurationMs(env.TASK_WORKSPACE_TTL, DEFAULTS.taskWorkspaceTtlMs),
    maxProcessOutputBytes: parseSizeBytes(env.MAX_PROCESS_OUTPUT, DEFAULTS.maxProcessOutputBytes),
  };
}
