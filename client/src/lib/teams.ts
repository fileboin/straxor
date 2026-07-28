import { api } from "./api.js";

// ── Teams ──

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  email: string;
}

export interface TeamDetail extends Team {
  members: TeamMember[];
  isOwner: boolean;
}

export interface ProjectCollaborator {
  id: string;
  userId: string;
  role: string;
  permissions: string;
  createdAt: string;
  email: string;
}

export interface CodeComment {
  id: string;
  userId: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  content: string;
  parentId: string | null;
  isResolved: boolean;
  createdAt: string;
  updatedAt: string;
  email?: string;
  replies?: CodeComment[];
}

// ── API ──

export async function listTeams(): Promise<Team[]> {
  return api("/teams");
}

export async function createTeam(name: string): Promise<Team> {
  return api("/teams", { method: "POST", body: JSON.stringify({ name }) });
}

export async function getTeam(id: string): Promise<TeamDetail> {
  return api(`/teams/${id}`);
}

export async function updateTeam(id: string, name: string): Promise<Team> {
  return api(`/teams/${id}`, { method: "PUT", body: JSON.stringify({ name }) });
}

export async function deleteTeam(id: string): Promise<void> {
  await api(`/teams/${id}`, { method: "DELETE" });
}

export async function addTeamMember(teamId: string, email: string, role?: string): Promise<TeamMember> {
  return api(`/teams/${teamId}/members`, { method: "POST", body: JSON.stringify({ email, role }) });
}

export async function removeTeamMember(teamId: string, memberId: string): Promise<void> {
  await api(`/teams/${teamId}/members/${memberId}`, { method: "DELETE" });
}

// ── Collaborators ──

export async function listCollaborators(projectId: string): Promise<ProjectCollaborator[]> {
  return api(`/projects/${projectId}/collaborators`);
}

export async function addCollaborator(projectId: string, email: string, role?: string): Promise<ProjectCollaborator> {
  return api(`/projects/${projectId}/collaborators`, { method: "POST", body: JSON.stringify({ email, role }) });
}

export async function updateCollaboratorRole(projectId: string, collabId: string, role: string): Promise<ProjectCollaborator> {
  return api(`/projects/${projectId}/collaborators/${collabId}`, { method: "PUT", body: JSON.stringify({ role }) });
}

export async function removeCollaborator(projectId: string, collabId: string): Promise<void> {
  await api(`/projects/${projectId}/collaborators/${collabId}`, { method: "DELETE" });
}

// ── Code Comments ──

export async function listComments(projectId: string, filePath?: string): Promise<CodeComment[]> {
  const params = filePath ? `?filePath=${encodeURIComponent(filePath)}` : "";
  return api(`/projects/${projectId}/comments${params}`);
}

export async function addComment(projectId: string, data: {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  content: string;
  parentId?: string;
}): Promise<CodeComment> {
  return api(`/projects/${projectId}/comments`, { method: "POST", body: JSON.stringify(data) });
}

export async function updateComment(projectId: string, commentId: string, data: { content?: string; isResolved?: boolean }): Promise<CodeComment> {
  return api(`/projects/${projectId}/comments/${commentId}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteComment(projectId: string, commentId: string): Promise<void> {
  await api(`/projects/${projectId}/comments/${commentId}`, { method: "DELETE" });
}
