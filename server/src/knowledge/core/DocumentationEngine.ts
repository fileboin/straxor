import type { KnowledgeStore } from "../storage/interfaces.js";
import type { DocSection, ProjectInfo, KnowledgeItem, DecisionRecord } from "./types.js";
import { randomUUID } from "node:crypto";

export class DocumentationEngine {
  constructor(private store: KnowledgeStore) {}

  async listDocs(projectId: string, category?: string): Promise<DocSection[]> {
    return this.store.listDocs(projectId, category);
  }

  async getDoc(projectId: string, id: string): Promise<DocSection | null> {
    return this.store.getDoc(projectId, id);
  }

  async saveDoc(projectId: string, data: {
    category: DocSection["category"]; title: string; content: string;
    format?: DocSection["format"]; order?: number;
  }): Promise<DocSection> {
    const now = Date.now();
    const existing = (await this.store.listDocs(projectId, data.category))
      .find((d) => d.title === data.title);
    if (existing) {
      existing.content = data.content;
      existing.updatedAt = now;
      existing.format = data.format ?? existing.format;
      existing.order = data.order ?? existing.order;
      await this.store.saveDoc(existing);
      return existing;
    }
    const doc: DocSection = {
      id: randomUUID(), projectId,
      category: data.category, title: data.title, content: data.content,
      format: data.format ?? "markdown", order: data.order ?? 0,
      createdAt: now, updatedAt: now,
    };
    await this.store.saveDoc(doc);
    return doc;
  }

  async deleteDoc(projectId: string, id: string): Promise<void> {
    await this.store.deleteDoc(projectId, id);
  }

  async generateArchitectureDoc(project: ProjectInfo, knowledge: KnowledgeItem[]): Promise<string> {
    const lines: string[] = [
      `# Architecture: ${project.name}`,
      ``,
      `## Overview`,
      `${project.description || "No description provided."}`,
      ``,
      `## Frameworks`,
      project.frameworks.map((f) => `- ${f}`).join("\n") || "None specified.",
      ``,
      `## Languages`,
      project.languages.map((l) => `- ${l}`).join("\n") || "None specified.",
      ``,
      `## Modules`,
      project.modules.map((m) => `- ${m}`).join("\n") || "None specified.",
      ``,
      `## Services`,
      project.services.map((s) => `- ${s}`).join("\n") || "None specified.",
      ``,
      `## API Endpoints`,
      knowledge.filter((k) => k.type === "api_endpoint").map((k) => `- ${k.summary}`).join("\n") || "None documented.",
      ``,
      `## Database`,
      project.databaseSchema.map((d) => `- ${d}`).join("\n") || "None specified.",
      ``,
      `## Deployment`,
      project.deploymentTargets.map((t) => `- ${t}`).join("\n") || "None specified.",
    ];
    return lines.join("\n");
  }

  async generateApiDoc(knowledge: KnowledgeItem[]): Promise<string> {
    const endpoints = knowledge.filter((k) => k.type === "api_endpoint");
    const lines: string[] = [
      `# API Documentation`,
      ``,
      endpoints.length === 0 ? "No API endpoints documented." :
      endpoints.map((ep) => {
        const v = ep.value as Record<string, unknown> || {};
        return `## ${ep.key}\n\n${ep.summary}\n\n${v.method ? `**Method:** ${v.method}\n` : ""}${v.path ? `**Path:** ${v.path}\n` : ""}${v.description ? `\n${v.description}` : ""}`;
      }).join("\n\n"),
    ];
    return lines.join("\n");
  }

  async generateDeploymentGuide(project: ProjectInfo): Promise<string> {
    return [
      `# Deployment Guide: ${project.name}`,
      ``,
      `## Targets`,
      project.deploymentTargets.map((t) => `- ${t}`).join("\n") || "None specified.",
      ``,
      `## Prerequisites`,
      `- Node.js 18+`,
      `- Git`,
      ...project.frameworks.map((f) => `- ${f} CLI`),
      ``,
      `## Build`,
      "```bash\nnpm install\nnpm run build\n```",
      ``,
      `## Deploy`,
      "Follow the target platform's deployment instructions.",
    ].join("\n");
  }
}
