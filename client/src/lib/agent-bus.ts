import { api } from "./api.js";

export type PanelSlot = "ask" | "agent";
export type AgentBusAction = "help" | "review" | "warn";

export interface AgentBusPayload {
  from: PanelSlot;
  to: PanelSlot;
  action: AgentBusAction;
  content: string;
  sourceMachineId?: string | null;
  targetMachineId?: string | null;
  sourceSessionId?: string | null;
  targetSessionId?: string | null;
  sourceRepo?: string | null;
  targetRepo?: string | null;
  hopCount?: number;
  chainId?: string;
}

export interface AgentBusEnvelope extends AgentBusPayload {
  id: string;
  createdAt: string;
  prompt: string;
  warning?: string;
  status?: string;
  sessionId?: string;
  metadata?: Record<string, unknown> | null;
  updatedAt?: string;
}

export async function createAgentBusTransfer(payload: AgentBusPayload): Promise<AgentBusEnvelope> {
  return api("/agent/bus/transfer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function analyzeAgentBusWarning(payload: AgentBusPayload): Promise<Pick<AgentBusEnvelope, "warning" | "prompt">> {
  return api("/agent/bus/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listAgentBusEvents(sessionId: string): Promise<AgentBusEnvelope[]> {
  return api(`/agent/bus/${sessionId}`);
}

export async function updateAgentBusEventStatus(eventId: string, status: string): Promise<AgentBusEnvelope> {
  return api(`/agent/bus/${eventId}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}
