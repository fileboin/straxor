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
