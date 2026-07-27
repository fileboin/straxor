import { api } from "./api.js";

export interface Session {
  id: string;
  userId: string;
  projectId: string;
  machineId: string;
  opencodeSessionId: string | null;
  title: string | null;
  status: string;
  agentConfig: string | null;
  askConfig: string | null;
  activePromptIds: string | null;
  lastTask: string | null;
  context: string | null;
  todoSnapshot: string | null;
  errorLog: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  label: string | null;
  toolCalls: string | null;
  createdAt: string;
}

export interface SessionWithMessages extends Session {
  messages: SessionMessage[];
}

// List sessions for a project
export async function fetchSessions(projectId: string): Promise<Session[]> {
  try {
    return await api<Session[]>(`/sessions?projectId=${projectId}`);
  } catch {
    return [];
  }
}

// Get session with messages
export async function fetchSession(id: string): Promise<SessionWithMessages | null> {
  try {
    return await api<SessionWithMessages>(`/sessions/${id}`);
  } catch {
    return null;
  }
}

// Create new session
export async function createSession(
  projectId: string,
  machineId: string,
  title?: string,
  agentConfig?: Record<string, unknown>,
  askConfig?: Record<string, unknown>
): Promise<Session> {
  return api<Session>("/sessions", {
    method: "POST",
    body: JSON.stringify({ projectId, machineId, title, agentConfig, askConfig }),
  });
}

// Update session metadata
export async function updateSession(
  id: string,
  updates: Partial<Pick<Session, "title" | "status" | "lastTask" | "context" | "todoSnapshot" | "errorLog" | "agentConfig" | "askConfig" | "activePromptIds">>
): Promise<Session> {
  return api<Session>(`/sessions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

// Save a message to a session
export async function saveMessage(
  sessionId: string,
  role: string,
  content: string,
  label?: string,
  toolCalls?: unknown[]
): Promise<SessionMessage> {
  return api<SessionMessage>(`/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ role, content, label, toolCalls }),
  });
}

// Get messages for a session
export async function fetchMessages(sessionId: string): Promise<SessionMessage[]> {
  try {
    return await api<SessionMessage[]>(`/sessions/${sessionId}/messages`);
  } catch {
    return [];
  }
}

// Delete a session
export async function deleteSession(id: string): Promise<void> {
  await api(`/sessions/${id}`, { method: "DELETE" });
}

// Auto-save helper — save user message + assistant message in one call
export async function saveConversationTurn(
  sessionId: string,
  userContent: string,
  assistantContent: string,
  assistantLabel?: string,
  toolCalls?: unknown[]
): Promise<void> {
  await Promise.all([
    saveMessage(sessionId, "user", userContent),
    saveMessage(sessionId, "assistant", assistantContent, assistantLabel, toolCalls),
  ]);
}

// Restore messages from DB into ChatMessage format for the workspace
export function restoreMessages(
  dbMessages: SessionMessage[]
): Array<{
  id: string;
  role: "user" | "assistant";
  content: string;
  label?: string;
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown>; status?: string; result?: string }>;
}> {
  return dbMessages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    label: m.label || undefined,
    toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : undefined,
  }));
}
