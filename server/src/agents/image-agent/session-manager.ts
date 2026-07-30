import type { ImageAgentSession, ImageAgentMessage } from "./types.js";

const sessions = new Map<string, ImageAgentSession>();

function generateId(): string {
  return `ia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSession(projectId: string, title: string): ImageAgentSession {
  const session: ImageAgentSession = {
    id: generateId(),
    projectId,
    title,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): ImageAgentSession | undefined {
  return sessions.get(id);
}

export function listSessions(projectId: string): ImageAgentSession[] {
  return Array.from(sessions.values())
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteSession(id: string): boolean {
  return sessions.delete(id);
}

export function addMessage(sessionId: string, message: ImageAgentMessage): ImageAgentSession | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  session.messages.push(message);
  session.updatedAt = Date.now();
  return session;
}

export function clearMessages(sessionId: string): ImageAgentSession | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  session.messages = [];
  session.updatedAt = Date.now();
  return session;
}
