import { api } from "./api.js";

export type TemplateId =
  | "empty"
  | "react"
  | "nextjs"
  | "node-api"
  | "fastapi"
  | "flutter"
  | "expo"
  | "laravel";

export interface Template {
  id: TemplateId;
  name: string;
  description: string;
  icon: string;
}

export const TEMPLATES: Template[] = [
  { id: "empty", name: "Empty", description: "Prazan projekat, počni od nule", icon: "⬜" },
  { id: "react", name: "React", description: "SPA sa Vite + React + Tailwind", icon: "⚛️" },
  { id: "nextjs", name: "Next.js", description: "Full-stack React sa SSR/SSG", icon: "▲" },
  { id: "node-api", name: "Node API", description: "Express REST API", icon: "🟢" },
  { id: "fastapi", name: "FastAPI", description: "Python REST API sa FastAPI", icon: "⚡" },
  { id: "flutter", name: "Flutter", description: "Cross-platform mobilna app", icon: "💙" },
  { id: "expo", name: "Expo", description: "React Native mobilna app", icon: "📱" },
  { id: "laravel", name: "Laravel", description: "PHP full-stack framework", icon: "🔶" },
];

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  template: TemplateId;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchProjects(): Promise<Project[]> {
  return api("/projects");
}

export async function createProject(
  name: string,
  description: string | undefined,
  template: TemplateId,
  color: string
): Promise<Project> {
  return api("/projects", {
    method: "POST",
    body: JSON.stringify({ name, description, template, color }),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await api(`/projects/${id}`, { method: "DELETE" });
}
