import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  machines: many(machines),
  apiKeys: many(userApiKeys),
  logs: many(logs),
}));

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  template: varchar("template", { length: 50 }).notNull().default("empty"),
  color: varchar("color", { length: 7 }).default("#3b82f6"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  machines: many(machines),
}));

export const machines = pgTable("machines", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  host: varchar("host", { length: 255 }).notNull(),
  port: integer("port").notNull().default(22),
  username: varchar("username", { length: 255 }).notNull(),
  authType: varchar("auth_type", { length: 20 }).notNull().default("password"),
  password: text("password"),
  privateKey: text("private_key"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  nodeInstalled: boolean("node_installed").default(false),
  opencodeRunning: boolean("opencode_running").default(false),
  opencodePort: integer("opencode_port").default(3000),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const machinesRelations = relations(machines, ({ one }) => ({
  user: one(users, { fields: [machines.userId], references: [users.id] }),
  project: one(projects, { fields: [machines.projectId], references: [projects.id] }),
}));

export const userApiKeys = pgTable("user_api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  providerId: varchar("provider_id", { length: 50 }).notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userApiKeysRelations = relations(userApiKeys, ({ one }) => ({
  user: one(users, { fields: [userApiKeys.userId], references: [users.id] }),
}));

export const logs = pgTable("logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 20 }).notNull(),
  level: varchar("level", { length: 10 }).notNull().default("info"),
  message: text("message").notNull(),
  source: varchar("source", { length: 100 }),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const logsRelations = relations(logs, ({ one }) => ({
  user: one(users, { fields: [logs.userId], references: [users.id] }),
}));

export const projectEnvs = pgTable("project_envs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 255 }).notNull(),
  value: text("value").notNull(),
  description: text("description"),
  isSecret: boolean("is_secret").default(false),
  isRequired: boolean("is_required").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectEnvsRelations = relations(projectEnvs, ({ one }) => ({
  project: one(projects, { fields: [projectEnvs.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectEnvs.userId], references: [users.id] }),
}));

export const projectEnvHistory = pgTable("project_env_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  envId: uuid("env_id"),
  action: varchar("action", { length: 20 }).notNull(),
  key: varchar("key", { length: 255 }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectEnvHistoryRelations = relations(projectEnvHistory, ({ one }) => ({
  project: one(projects, { fields: [projectEnvHistory.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectEnvHistory.userId], references: [users.id] }),
}));

export const deployments = pgTable("deployments", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  target: varchar("target", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("building"),
  liveUrl: text("live_url"),
  branch: varchar("branch", { length: 100 }).notNull().default("main"),
  commitHash: varchar("commit_hash", { length: 40 }),
  commitMessage: text("commit_message"),
  startedAt: timestamp("started_at").notNull(),
  finishedAt: timestamp("finished_at"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  project: one(projects, { fields: [deployments.projectId], references: [projects.id] }),
  user: one(users, { fields: [deployments.userId], references: [users.id] }),
}));

export const deploymentBuildLogs = pgTable("deployment_build_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  deploymentId: uuid("deployment_id")
    .notNull()
    .references(() => deployments.id, { onDelete: "cascade" }),
  level: varchar("level", { length: 10 }).notNull().default("info"),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const deploymentBuildLogsRelations = relations(deploymentBuildLogs, ({ one }) => ({
  deployment: one(deployments, { fields: [deploymentBuildLogs.deploymentId], references: [deployments.id] }),
}));

export const consoleEntries = pgTable("console_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 20 }).notNull(),
  level: varchar("level", { length: 10 }).notNull().default("error"),
  message: text("message").notNull(),
  source: varchar("source", { length: 100 }),
  stackTrace: text("stack_trace"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const consoleEntriesRelations = relations(consoleEntries, ({ one }) => ({
  user: one(users, { fields: [consoleEntries.userId], references: [users.id] }),
}));

export const userPermissions = pgTable("user_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  toolId: varchar("tool_id", { length: 50 }).notNull(),
  level: varchar("level", { length: 10 }).notNull().default("ask"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
  user: one(users, { fields: [userPermissions.userId], references: [users.id] }),
}));

export const savedPrompts = pgTable("saved_prompts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 20 }).notNull().default("instruction"),
  isGlobal: boolean("is_global").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const savedPromptsRelations = relations(savedPrompts, ({ one }) => ({
  user: one(users, { fields: [savedPrompts.userId], references: [users.id] }),
  project: one(projects, { fields: [savedPrompts.projectId], references: [projects.id] }),
}));

export const notificationConfigs = pgTable("notification_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  channel: varchar("channel", { length: 20 }).notNull(),
  enabled: boolean("enabled").default(false),
  events: text("events").default("[]"),
  config: text("config").default("{}"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notificationConfigsRelations = relations(notificationConfigs, ({ one }) => ({
  user: one(users, { fields: [notificationConfigs.userId], references: [users.id] }),
}));

export const notificationHistory = pgTable("notification_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  channel: varchar("channel", { length: 20 }).notNull(),
  eventType: varchar("event_type", { length: 30 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  severity: varchar("severity", { length: 10 }).notNull().default("info"),
  success: boolean("success").notNull().default(true),
  error: text("error"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationHistoryRelations = relations(notificationHistory, ({ one }) => ({
  user: one(users, { fields: [notificationHistory.userId], references: [users.id] }),
}));

export const worktrees = pgTable("worktrees", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  machineId: uuid("machine_id")
    .notNull()
    .references(() => machines.id, { onDelete: "cascade" }),
  branch: varchar("branch", { length: 255 }).notNull(),
  worktreePath: varchar("worktree_path", { length: 500 }).notNull(),
  taskName: varchar("task_name", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const worktreesRelations = relations(worktrees, ({ one }) => ({
  user: one(users, { fields: [worktrees.userId], references: [users.id] }),
  machine: one(machines, { fields: [worktrees.machineId], references: [machines.id] }),
}));

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  machineId: uuid("machine_id")
    .notNull()
    .references(() => machines.id, { onDelete: "cascade" }),
  opencodeSessionId: varchar("opencode_session_id", { length: 255 }),
  title: varchar("title", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  agentConfig: text("agent_config"),
  askConfig: text("ask_config"),
  activePromptIds: text("active_prompt_ids"),
  lastTask: text("last_task"),
  context: text("context"),
  todoSnapshot: text("todo_snapshot"),
  errorLog: text("error_log"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
  project: one(projects, { fields: [sessions.projectId], references: [projects.id] }),
  machine: one(machines, { fields: [sessions.machineId], references: [machines.id] }),
}));

export const sessionMessages = pgTable("session_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull().default(""),
  label: varchar("label", { length: 100 }),
  toolCalls: text("tool_calls"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessionMessagesRelations = relations(sessionMessages, ({ one }) => ({
  session: one(sessions, { fields: [sessionMessages.sessionId], references: [sessions.id] }),
}));

export const restorePoints = pgTable("restore_points", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  machineId: uuid("machine_id")
    .notNull()
    .references(() => machines.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 20 }).notNull().default("version"),
  snapshotPath: varchar("snapshot_path", { length: 500 }).notNull(),
  gitCommit: varchar("git_commit", { length: 40 }),
  fileCount: integer("file_count").default(0),
  totalSize: varchar("total_size", { length: 50 }).default("0 B"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const restorePointsRelations = relations(restorePoints, ({ one }) => ({
  user: one(users, { fields: [restorePoints.userId], references: [users.id] }),
  project: one(projects, { fields: [restorePoints.projectId], references: [projects.id] }),
  machine: one(machines, { fields: [restorePoints.machineId], references: [machines.id] }),
}));

export const projectRules = pgTable("project_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 30 }).notNull().default("general"),
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectRulesRelations = relations(projectRules, ({ one }) => ({
  project: one(projects, { fields: [projectRules.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectRules.userId], references: [users.id] }),
}));

export const memories = pgTable("memories", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 255 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 30 }).notNull().default("general"),
  source: varchar("source", { length: 50 }).notNull().default("manual"),
  isGlobal: boolean("is_global").default(false),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const memoriesRelations = relations(memories, ({ one }) => ({
  user: one(users, { fields: [memories.userId], references: [users.id] }),
  project: one(projects, { fields: [memories.projectId], references: [projects.id] }),
}));

export const webResearch = pgTable("web_research", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: varchar("title", { length: 500 }),
  content: text("content"),
  summary: text("summary"),
  tokenCount: integer("token_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webResearchRelations = relations(webResearch, ({ one }) => ({
  user: one(users, { fields: [webResearch.userId], references: [users.id] }),
}));

export const mcpServers = pgTable("mcp_servers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }).default("🔌"),
  category: varchar("category", { length: 50 }).default("custom"),
  command: varchar("command", { length: 255 }).notNull(),
  args: text("args").default("[]"),
  env: text("env").default("{}"),
  tools: text("tools").default("[]"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const mcpServersRelations = relations(mcpServers, ({ one }) => ({
  user: one(users, { fields: [mcpServers.userId], references: [users.id] }),
}));

export const infraConfigs = pgTable("infra_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  machineId: uuid("machine_id").references(() => machines.id, { onDelete: "set null" }),
  type: varchar("type", { length: 30 }).notNull(),
  adapter: varchar("adapter", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  status: varchar("status", { length: 20 }).default("pending"),
  config: text("config").default("{}"),
  credentials: text("credentials").default("{}"),
  lastChecked: timestamp("last_checked"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const infraConfigsRelations = relations(infraConfigs, ({ one }) => ({
  user: one(users, { fields: [infraConfigs.userId], references: [users.id] }),
  project: one(projects, { fields: [infraConfigs.projectId], references: [projects.id] }),
  machine: one(machines, { fields: [infraConfigs.machineId], references: [machines.id] }),
}));

// ── Team Collaboration ──

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const teamsRelations = relations(teams, ({ one, many }) => ({
  owner: one(users, { fields: [teams.ownerId], references: [users.id] }),
  members: many(teamMembers),
}));

export const teamMembers = pgTable("team_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  invitedBy: uuid("invited_by").references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
  inviter: one(users, { fields: [teamMembers.invitedBy], references: [users.id] }),
}));

export const projectCollaborators = pgTable("project_collaborators", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  permissions: text("permissions").default("{}"),
  addedBy: uuid("added_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectCollaboratorsRelations = relations(projectCollaborators, ({ one }) => ({
  project: one(projects, { fields: [projectCollaborators.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectCollaborators.userId], references: [users.id] }),
  adder: one(users, { fields: [projectCollaborators.addedBy], references: [users.id] }),
}));

export const codeComments = pgTable("code_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  lineStart: integer("line_start").notNull(),
  lineEnd: integer("line_end").notNull(),
  content: text("content").notNull(),
  parentId: uuid("parent_id").references(() => codeComments.id, { onDelete: "cascade" }),
  isResolved: boolean("is_resolved").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const codeCommentsRelations = relations(codeComments, ({ one, many }) => ({
  project: one(projects, { fields: [codeComments.projectId], references: [projects.id] }),
  user: one(users, { fields: [codeComments.userId], references: [users.id] }),
  parent: one(codeComments, { fields: [codeComments.parentId], references: [codeComments.id] }),
  replies: many(codeComments, { relationName: "commentReplies" }),
}));

// ── Organization ──

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  billingEmail: varchar("billing_email", { length: 255 }),
  plan: varchar("plan", { length: 50 }).default("free"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, { fields: [organizations.ownerId], references: [users.id] }),
  members: many(organizationMembers),
  apiKeys: many(organizationApiKeys),
  policies: many(organizationPolicies),
  budgets: many(budgetLimits),
}));

export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  org: one(organizations, { fields: [organizationMembers.orgId], references: [organizations.id] }),
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
}));

export const organizationApiKeys = pgTable("organization_api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(),
  label: varchar("label", { length: 255 }),
  encryptedKey: text("encrypted_key").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizationApiKeysRelations = relations(organizationApiKeys, ({ one }) => ({
  org: one(organizations, { fields: [organizationApiKeys.orgId], references: [organizations.id] }),
  creator: one(users, { fields: [organizationApiKeys.createdBy], references: [users.id] }),
}));

export const organizationPolicies = pgTable("organization_policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 30 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  config: text("config").default("{}"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organizationPoliciesRelations = relations(organizationPolicies, ({ one }) => ({
  org: one(organizations, { fields: [organizationPolicies.orgId], references: [organizations.id] }),
}));

export const budgetLimits = pgTable("budget_limits", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  monthlyLimit: integer("monthly_limit").notNull().default(0),
  currentUsage: integer("current_usage").notNull().default(0),
  currency: varchar("currency", { length: 10 }).default("USD"),
  alertAtPercent: integer("alert_at_percent").default(80),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const budgetLimitsRelations = relations(budgetLimits, ({ one }) => ({
  org: one(organizations, { fields: [budgetLimits.orgId], references: [organizations.id] }),
  project: one(projects, { fields: [budgetLimits.projectId], references: [projects.id] }),
}));

// ── Enterprise Security & Compliance ──

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 100 }).notNull(),
  resource: varchar("resource", { length: 255 }),
  details: text("details").default("{}"),
  ip: varchar("ip", { length: 45 }),
  userAgent: text("user_agent"),
  severity: varchar("severity", { length: 20 }).default("info"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
  org: one(organizations, { fields: [auditLogs.orgId], references: [organizations.id] }),
}));

export const ssoConfigs = pgTable("sso_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(),
  label: varchar("label", { length: 255 }),
  config: text("config").default("{}"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ssoConfigsRelations = relations(ssoConfigs, ({ one }) => ({
  org: one(organizations, { fields: [ssoConfigs.orgId], references: [organizations.id] }),
}));

export const encryptionKeys = pgTable("encryption_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  algorithm: varchar("algorithm", { length: 50 }).notNull().default("aes-256-gcm"),
  keyData: text("key_data"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const encryptionKeysRelations = relations(encryptionKeys, ({ one }) => ({
  org: one(organizations, { fields: [encryptionKeys.orgId], references: [organizations.id] }),
}));

export const complianceReports = pgTable("compliance_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  standard: varchar("standard", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  findings: text("findings").default("[]"),
  summary: text("summary"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export const complianceReportsRelations = relations(complianceReports, ({ one }) => ({
  org: one(organizations, { fields: [complianceReports.orgId], references: [organizations.id] }),
}));

// ── Plugin & Extension SDK ──

export const plugins = pgTable("plugins", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  type: varchar("type", { length: 50 }).notNull().default("custom"),
  version: varchar("version", { length: 20 }).notNull().default("1.0.0"),
  description: text("description"),
  author: varchar("author", { length: 255 }),
  icon: varchar("icon", { length: 50 }).default("🧩"),
  configSchema: text("config_schema").default("{}"),
  permissions: text("permissions").default("[]"),
  entryPoint: varchar("entry_point", { length: 500 }),
  settings: text("settings").default("{}"),
  isInstalled: boolean("is_installed").notNull().default(false),
  isBuiltin: boolean("is_builtin").notNull().default(false),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pluginsRelations = relations(plugins, () => ({}));

export const pluginEvents = pgTable("plugin_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
  event: varchar("event", { length: 255 }).notNull(),
  handler: varchar("handler", { length: 500 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pluginEventsRelations = relations(pluginEvents, ({ one }) => ({
  plugin: one(plugins, { fields: [pluginEvents.pluginId], references: [plugins.id] }),
}));
