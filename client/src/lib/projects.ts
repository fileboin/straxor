import { api } from "./api.js";

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchProjects(): Promise<Project[]> {
  return api("/projects");
}

export async function createProject(
  name: string,
  description?: string
): Promise<Project> {
  return api("/projects", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await api(`/projects/${id}`, { method: "DELETE" });
}
