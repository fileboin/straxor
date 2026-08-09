import { api } from "./api.js";

export interface StoredHandshakeSelfTest {
  id: string;
  sessionId: string;
  userId: string;
  projectId: string | null;
  chainId: string;
  mode: string;
  status: string;
  askRepo: string | null;
  agentRepo: string | null;
  askMachineId: string | null;
  agentMachineId: string | null;
  busEventId: string | null;
  result: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export async function runHandshakeSelfTestRecord(payload: {
  sessionId: string;
  projectId?: string | null;
  askRepo?: string | null;
  agentRepo?: string | null;
  askMachineId?: string | null;
  agentMachineId?: string | null;
  busEventId?: string | null;
  chainId?: string | null;
  result: Record<string, unknown>;
}) {
  return api<{ test: StoredHandshakeSelfTest }>("/handshake-self-test/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateHandshakeSelfTestRecord(id: string, payload: {
  result?: Record<string, unknown>;
  status?: string;
  busEventId?: string | null;
}) {
  return api<StoredHandshakeSelfTest>(`/handshake-self-test/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function listHandshakeSelfTestHistory(sessionId: string) {
  return api<StoredHandshakeSelfTest[]>(`/handshake-self-test/history/${sessionId}`);
}
