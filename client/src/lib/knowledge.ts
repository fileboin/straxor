import { api } from "./api.js";

// Project info
export function getProjectKnowledge(projectId: string): Promise<any> { return api(`/knowledge/${projectId}/project`); }
export function saveProjectKnowledge(projectId: string, data: any): Promise<any> { return api(`/knowledge/${projectId}/project`, { method: "PUT", body: data }); }

// Knowledge items
export function listKnowledge(projectId: string, type?: string): Promise<any[]> { return api(`/knowledge/${projectId}/knowledge${type ? `?type=${type}` : ""}`); }
export function getKnowledge(projectId: string, key: string): Promise<any> { return api(`/knowledge/${projectId}/knowledge/${key}`); }
export function createKnowledge(projectId: string, data: any): Promise<any> { return api(`/knowledge/${projectId}/knowledge`, { method: "POST", body: data }); }
export function updateKnowledge(projectId: string, key: string, data: any): Promise<any> { return api(`/knowledge/${projectId}/knowledge/${key}`, { method: "PUT", body: data }); }
export function deleteKnowledge(projectId: string, key: string): Promise<any> { return api(`/knowledge/${projectId}/knowledge/${key}`, { method: "DELETE" }); }

// Graph
export function getGraphNodes(projectId: string): Promise<any[]> { return api(`/knowledge/${projectId}/graph/nodes`); }
export function createGraphNode(projectId: string, data: any): Promise<any> { return api(`/knowledge/${projectId}/graph/nodes`, { method: "POST", body: data }); }
export function deleteGraphNode(projectId: string, nodeId: string): Promise<any> { return api(`/knowledge/${projectId}/graph/nodes/${nodeId}`, { method: "DELETE" }); }
export function getGraphEdges(projectId: string): Promise<any[]> { return api(`/knowledge/${projectId}/graph/edges`); }
export function createGraphEdge(projectId: string, data: any): Promise<any> { return api(`/knowledge/${projectId}/graph/edges`, { method: "POST", body: data }); }
export function getConnectedNodes(projectId: string, nodeId: string): Promise<any[]> { return api(`/knowledge/${projectId}/graph/connected/${nodeId}`); }

// Decisions
export function listDecisions(projectId: string): Promise<any[]> { return api(`/knowledge/${projectId}/decisions`); }
export function createDecision(projectId: string, data: any): Promise<any> { return api(`/knowledge/${projectId}/decisions`, { method: "POST", body: data }); }
export function updateDecision(projectId: string, id: string, data: any): Promise<any> { return api(`/knowledge/${projectId}/decisions/${id}`, { method: "PUT", body: data }); }
export function deleteDecision(projectId: string, id: string): Promise<any> { return api(`/knowledge/${projectId}/decisions/${id}`, { method: "DELETE" }); }

// Documentation
export function listDocs(projectId: string, category?: string): Promise<any[]> { return api(`/knowledge/${projectId}/docs${category ? `?category=${category}` : ""}`); }
export function createDoc(projectId: string, data: any): Promise<any> { return api(`/knowledge/${projectId}/docs`, { method: "POST", body: data }); }
export function deleteDoc(projectId: string, id: string): Promise<any> { return api(`/knowledge/${projectId}/docs/${id}`, { method: "DELETE" }); }

// Versions
export function listVersions(projectId: string): Promise<any[]> { return api(`/knowledge/${projectId}/versions`); }
export function createVersion(projectId: string, data: any): Promise<any> { return api(`/knowledge/${projectId}/versions`, { method: "POST", body: data }); }

// Search
export function searchKnowledge(projectId: string, query: string): Promise<any[]> { return api(`/knowledge/${projectId}/search?q=${encodeURIComponent(query)}`); }

// Context
export function buildContext(projectId: string, options?: any): Promise<any> { return api(`/knowledge/${projectId}/context`, { method: "POST", body: options || {} }); }

// Auto learn
export function autoLearn(projectId: string, data: any): Promise<any> { return api(`/knowledge/${projectId}/learn`, { method: "POST", body: data }); }
