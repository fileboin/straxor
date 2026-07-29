export type KnowledgeSource = "manual" | "file_scan" | "git_commit" | "ai_analysis" | "plugin" | "api" | "workspace" | "editor";
export type Confidence = 0 | 1 | 2 | 3 | 4 | 5;
export type VerificationStatus = "unverified" | "verified" | "stale" | "contradicted";

export interface KnowledgeItem {
  id: string;
  projectId: string;
  type: KnowledgeType;
  key: string;
  value: unknown;
  summary: string;
  tags: string[];
  source: KnowledgeSource;
  confidence: Confidence;
  owner: string;
  verificationStatus: VerificationStatus;
  createdAt: number;
  updatedAt: number;
}

export type KnowledgeType =
  | "architecture"
  | "framework"
  | "language"
  | "module"
  | "service"
  | "api_endpoint"
  | "database_table"
  | "deployment_target"
  | "coding_standard"
  | "business_logic"
  | "technical_decision"
  | "documentation"
  | "requirement"
  | "goal"
  | "known_issue"
  | "future_plan"
  | "completed_task"
  | "convention"
  | "dependency"
  | "environment_variable";

export interface KnowledgeGraphNode {
  id: string;
  projectId: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeGraphEdge {
  id: string;
  projectId: string;
  sourceId: string;
  targetId: string;
  relation: string;
  properties: Record<string, unknown>;
  createdAt: number;
}

export interface DecisionRecord {
  id: string;
  projectId: string;
  title: string;
  context: string;
  decision: string;
  reason: string;
  alternatives: string[];
  consequences: string[];
  status: "proposed" | "accepted" | "deprecated" | "rejected";
  tags: string[];
  owner: string;
  createdAt: number;
  updatedAt: number;
}

export interface DocSection {
  id: string;
  projectId: string;
  category: DocCategory;
  title: string;
  content: string;
  format: "markdown" | "json" | "yaml";
  order: number;
  createdAt: number;
  updatedAt: number;
}

export type DocCategory =
  | "architecture"
  | "api"
  | "modules"
  | "deployment"
  | "onboarding"
  | "handbook"
  | "glossary"
  | "changelog";

export interface SearchResult {
  item: KnowledgeItem | DecisionRecord | DocSection;
  type: "knowledge" | "decision" | "documentation";
  score: number;
  matches: string[];
}

export interface ContextBuildOptions {
  maxTokens?: number;
  includeTypes?: KnowledgeType[];
  includeDecisions?: boolean;
  includeDocs?: boolean;
  focusTags?: string[];
  recencyWeight?: number;
}

export interface ContextResult {
  context: string;
  tokens: number;
  sources: { type: string; key: string; summary: string }[];
}

export interface VersionSnapshot {
  id: string;
  projectId: string;
  version: string;
  label: string;
  changes: { type: string; description: string }[];
  knowledgeDelta: { added: string[]; removed: string[]; modified: string[] };
  createdAt: number;
}

export interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  architecture: string;
  frameworks: string[];
  languages: string[];
  rootDir: string;
  importantFolders: string[];
  modules: string[];
  services: string[];
  apis: string[];
  databaseSchema: string[];
  deploymentTargets: string[];
  codingStandards: string[];
  projectGoals: string[];
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeEvent {
  type: "created" | "updated" | "deleted";
  itemType: string;
  itemId: string;
  projectId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export type KnowledgeChangeHandler = (event: KnowledgeEvent) => void;
