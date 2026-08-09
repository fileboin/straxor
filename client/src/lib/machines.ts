import { api } from "./api.js";

export interface MachineRecord {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "key";
  password: string | null;
  privateKey: string | null;
  status: string;
  nodeInstalled: boolean | null;
  opencodeRunning: boolean | null;
  opencodePort: number | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listMachines(): Promise<MachineRecord[]> {
  return api<MachineRecord[]>("/machines");
}

export type CoolifyInstallStatus =
  | "connecting"
  | "checking-os"
  | "checking-docker"
  | "installing-docker"
  | "checking-coolify"
  | "installing-coolify"
  | "ready"
  | "error";

export interface CoolifyInstallEvent {
  status: CoolifyInstallStatus;
  message: string;
  details?: string;
}

export async function installCoolify(
  machineId: string,
  onEvent: (event: CoolifyInstallEvent) => void,
): Promise<void> {
  const token = localStorage.getItem("token");
  const response = await fetch(`/api/machines/${machineId}/install-coolify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  const reader = response.body?.getReader();
  if (!reader) throw new Error("SSE konekcija za Coolify instalaciju nije dostupna");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") return;
      const event = JSON.parse(data) as CoolifyInstallEvent;
      onEvent(event);
      if (event.status === "error") throw new Error(event.message);
    }
  }
}
