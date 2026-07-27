export type PreviewTarget =
  | "local"
  | "vps"
  | "docker"
  | "render"
  | "railway"
  | "flyio"
  | "vercel"
  | "netlify";

export type DeviceSize = "desktop" | "tablet" | "mobile";

export interface DevicePreset {
  id: DeviceSize;
  label: string;
  width: number;
  height: number;
  icon: string;
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: "desktop", label: "Desktop", width: 1280, height: 800, icon: "🖥" },
  { id: "tablet", label: "Tablet", width: 768, height: 1024, icon: "📱" },
  { id: "mobile", label: "Mobitel", width: 375, height: 812, icon: "📱" },
];

export interface PreviewConfig {
  machineId: string;
  target: PreviewTarget;
  port?: number;
  rootPath?: string;
  framework?: string;       // auto-detected or manual
  buildCommand?: string;
  devCommand?: string;
  envVars?: Record<string, string>;
}

export interface PreviewStatus {
  running: boolean;
  url: string | null;        // public/proxy URL
  internalUrl: string | null; // internal dev server URL (e.g. localhost:5173)
  target: PreviewTarget;
  port: number;
  pid: number | null;
  uptime: number | null;
  framework: string | null;
  error: string | null;
}

export interface PreviewLog {
  timestamp: number;
  level: "info" | "warn" | "error" | "stdout" | "stderr";
  message: string;
}

export interface PreviewAdapter {
  start(config: PreviewConfig): Promise<PreviewStatus>;
  stop(machineId: string): Promise<void>;
  getStatus(machineId: string): Promise<PreviewStatus>;
  getLogs(machineId: string, limit?: number): Promise<PreviewLog[]>;
  getFramework(machineId: string, rootPath?: string): Promise<string | null>;
}
