import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  plan: varchar("plan", { length: 50 }).default("free"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationToken: varchar("verification_token", { length: 255 }),
  resetToken: varchar("reset_token", { length: 255 }),
  resetTokenExpires: timestamp("reset_token_expires"),
  totpSecret: varchar("totp_secret", { length: 255 }),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
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
  label: varchar("label", { length: 255 }),
  encryptedKey: text("encrypted_key").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userApiKeysRelations = relations(userApiKeys, ({ one }) => ({
  user: one(users, { fields: [userApiKeys.userId], references: [users.id] }),
}));

export const gitConnections = pgTable("git_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 50 }).notNull(),
  name: varchar("name", { length: 120 }).notNull().default("GitHub"),
  username: varchar("username", { length: 120 }),
  isDefault: boolean("is_default").notNull().default(false),
  connectionType: varchar("connection_type", { length: 20 }).notNull().default("token"),
  encryptedToken: text("encrypted_token").notNull(),
  baseUrl: text("base_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const gitConnectionsRelations = relations(gitConnections, ({ one }) => ({
  user: one(users, { fields: [gitConnections.userId], references: [users.id] }),
}));

export const repoConnections = pgTable("repo_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 50 }).notNull(),
  owner: varchar("owner", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 511 }).notNull(),
  cloneUrl: text("clone_url").notNull(),
  defaultBranch: varchar("default_branch", { length: 255 }).notNull().default("main"),
  isActive: boolean("is_active").notNull().default(false),
  slot: varchar("slot", { length: 20 }).notNull().default("agent"),
  connectionType: varchar("connection_type", { length: 20 }).notNull().default("token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const repoConnectionsRelations = relations(repoConnections, ({ one }) => ({
  user: one(users, { fields: [repoConnections.userId], references: [users.id] }),
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
  machineId: varchar("machine_id", { length: 255 }).notNull(),
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

export const agentBusEvents = pgTable("agent_bus_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  chainId: varchar("chain_id", { length: 255 }).notNull(),
  fromPanel: varchar("from_panel", { length: 20 }).notNull(),
  toPanel: varchar("to_panel", { length: 20 }).notNull(),
  action: varchar("action", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  hopCount: integer("hop_count").notNull().default(0),
  warning: text("warning"),
  prompt: text("prompt").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentBusEventsRelations = relations(agentBusEvents, ({ one }) => ({
  session: one(sessions, { fields: [agentBusEvents.sessionId], references: [sessions.id] }),
  user: one(users, { fields: [agentBusEvents.userId], references: [users.id] }),
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
  parentId: uuid("parent_id").references((): any => codeComments.id, { onDelete: "cascade" }),
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

// ── Marketplace & Community Templates ──

export type MarketplaceItemType = "template" | "agent" | "prompt" | "mcp" | "workflow" | "plugin";

export const marketplaceItems = pgTable("marketplace_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  version: varchar("version", { length: 20 }).notNull().default("1.0.0"),
  description: text("description"),
  longDescription: text("long_description"),
  icon: varchar("icon", { length: 50 }).default("📦"),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  authorName: varchar("author_name", { length: 255 }),
  tags: text("tags").default("[]"),
  category: varchar("category", { length: 100 }),
  content: text("content").default("{}"),
  configSchema: text("config_schema").default("{}"),
  isPublic: boolean("is_public").notNull().default(true),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  installCount: integer("install_count").notNull().default(0),
  rating: integer("rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const marketplaceItemsRelations = relations(marketplaceItems, ({ one, many }) => ({
  author: one(users, { fields: [marketplaceItems.authorId], references: [users.id] }),
  org: one(organizations, { fields: [marketplaceItems.orgId], references: [organizations.id] }),
  reviews: many(marketplaceReviews),
}));

export const marketplaceReviews = pgTable("marketplace_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id").notNull().references(() => marketplaceItems.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  rating: integer("rating").notNull().default(5),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const marketplaceReviewsRelations = relations(marketplaceReviews, ({ one }) => ({
  item: one(marketplaceItems, { fields: [marketplaceReviews.itemId], references: [marketplaceItems.id] }),
  user: one(users, { fields: [marketplaceReviews.userId], references: [users.id] }),
}));

export const marketplaceInstallations = pgTable("marketplace_installations", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id").notNull().references(() => marketplaceItems.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  config: text("config").default("{}"),
  installedAt: timestamp("installed_at").defaultNow().notNull(),
});

export const marketplaceInstallationsRelations = relations(marketplaceInstallations, ({ one }) => ({
  item: one(marketplaceItems, { fields: [marketplaceInstallations.itemId], references: [marketplaceItems.id] }),
  user: one(users, { fields: [marketplaceInstallations.userId], references: [users.id] }),
  project: one(projects, { fields: [marketplaceInstallations.projectId], references: [projects.id] }),
}));

// ── Global Scale & High Availability ──

export const runtimeNodes = pgTable("runtime_nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: varchar("url", { length: 500 }),
  status: varchar("status", { length: 30 }).notNull().default("offline"),
  capabilities: text("capabilities").default("[]"),
  region: varchar("region", { length: 100 }).default("default"),
  version: varchar("version", { length: 20 }).default("1.0.0"),
  config: text("config").default("{}"),
  priority: integer("priority").notNull().default(0),
  lastHeartbeat: timestamp("last_heartbeat"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const runtimeNodesRelations = relations(runtimeNodes, () => ({}));

export const loadBalancerConfigs = pgTable("load_balancer_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 100 }),
  strategy: varchar("strategy", { length: 50 }).notNull().default("round-robin"),
  targets: text("targets").default("[]"),
  rules: text("rules").default("[]"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const loadBalancerConfigsRelations = relations(loadBalancerConfigs, () => ({}));

export const failoverConfigs = pgTable("failover_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 100 }).notNull(),
  primaryEndpoint: varchar("primary_endpoint", { length: 500 }),
  backupEndpoints: text("backup_endpoints").default("[]"),
  strategy: varchar("strategy", { length: 50 }).notNull().default("auto"),
  healthCheckInterval: integer("health_check_interval").notNull().default(30),
  maxRetries: integer("max_retries").notNull().default(3),
  cooldownPeriod: integer("cooldown_period").notNull().default(60),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const failoverConfigsRelations = relations(failoverConfigs, () => ({}));

export const scalingPolicies = pgTable("scaling_policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  target: varchar("target", { length: 100 }).notNull().default("multi-agent"),
  metric: varchar("metric", { length: 100 }).notNull().default("concurrent_sessions"),
  minInstances: integer("min_instances").notNull().default(1),
  maxInstances: integer("max_instances").notNull().default(10),
  scaleUpThreshold: integer("scale_up_threshold").notNull().default(80),
  scaleDownThreshold: integer("scale_down_threshold").notNull().default(30),
  cooldownSeconds: integer("cooldown_seconds").notNull().default(120),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scalingPoliciesRelations = relations(scalingPolicies, () => ({}));

// ── Enterprise Security, Disaster Recovery & Offline Mode ──

export const vaultSecrets = pgTable("vault_secrets", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("api_key"),
  encryptedValue: text("encrypted_value").notNull(),
  algorithm: varchar("algorithm", { length: 50 }).notNull().default("aes-256-gcm"),
  metadata: text("metadata").default("{}"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vaultSecretsRelations = relations(vaultSecrets, ({ one }) => ({
  org: one(organizations, { fields: [vaultSecrets.orgId], references: [organizations.id] }),
}));

export const agentSessions = pgTable("agent_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  agentType: varchar("agent_type", { length: 50 }).notNull().default("general"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  metadata: text("metadata").default("{}"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentSessionsRelations = relations(agentSessions, ({ one }) => ({
  project: one(projects, { fields: [agentSessions.projectId], references: [projects.id] }),
  user: one(users, { fields: [agentSessions.userId], references: [users.id] }),
}));

export const sessionGuardrails = pgTable("session_guardrails", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").references(() => agentSessions.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  maxTokens: integer("max_tokens"),
  maxCost: integer("max_cost"),
  currentTokens: integer("current_tokens").notNull().default(0),
  currentCost: integer("current_cost").notNull().default(0),
  isPaused: boolean("is_paused").notNull().default(false),
  triggeredAt: timestamp("triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sessionGuardrailsRelations = relations(sessionGuardrails, ({ one }) => ({
  session: one(agentSessions, { fields: [sessionGuardrails.sessionId], references: [agentSessions.id] }),
  project: one(projects, { fields: [sessionGuardrails.projectId], references: [projects.id] }),
}));

export const systemSnapshots = pgTable("system_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("full"),
  filePath: varchar("file_path", { length: 500 }),
  size: integer("size"),
  checksum: varchar("checksum", { length: 128 }),
  encryptionKey: varchar("encryption_key", { length: 500 }),
  metadata: text("metadata").default("{}"),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const systemSnapshotsRelations = relations(systemSnapshots, () => ({}));

export const offlineConfig = pgTable("offline_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  localModelProvider: varchar("local_model_provider", { length: 100 }).default("ollama"),
  localModelName: varchar("local_model_name", { length: 255 }).default("llama3"),
  localGitPath: varchar("local_git_path", { length: 500 }),
  localRuntime: varchar("local_runtime", { length: 100 }).default("opencode"),
  airGapped: boolean("air_gapped").notNull().default(false),
  allowedDomains: text("allowed_domains").default("[]"),
  syncOnReconnect: boolean("sync_on_reconnect").notNull().default(true),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const offlineConfigRelations = relations(offlineConfig, () => ({}));

// ── Admin Control Center ──

export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const featureFlagsRelations = relations(featureFlags, () => ({}));

export const tariffs = pgTable("tariffs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  price: integer("price").notNull().default(0),
  currency: varchar("currency", { length: 10 }).default("USD"),
  billingCycle: varchar("billing_cycle", { length: 50 }).default("monthly"),
  maxProjects: integer("max_projects").default(1),
  maxAgents: integer("max_agents").default(1),
  maxRuntimes: integer("max_runtimes").default(1),
  maxMembers: integer("max_members").default(1),
  storageLimit: integer("storage_limit").default(100),
  bandwidthLimit: integer("bandwidth_limit").default(1000),
  aiLimits: text("ai_limits").default("{}"),
  allowedIntegrations: text("allowed_integrations").default("[]"),
  features: text("features").default("[]"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tariffsRelations = relations(tariffs, () => ({}));

export const walletAccounts = pgTable("wallet_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  currency: varchar("currency", { length: 10 }).default("USD"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const walletAccountsRelations = relations(walletAccounts, ({ one }) => ({
  user: one(users, { fields: [walletAccounts.userId], references: [users.id] }),
}));

export const walletTransactions = pgTable("wallet_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  walletId: uuid("wallet_id").notNull().references(() => walletAccounts.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  amount: integer("amount").notNull(),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  currency: varchar("currency", { length: 10 }).default("USD"),
  description: text("description"),
  reference: varchar("reference", { length: 255 }),
  metadata: text("metadata").default("{}"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  wallet: one(walletAccounts, { fields: [walletTransactions.walletId], references: [walletAccounts.id] }),
}));

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tariffId: uuid("tariff_id").references(() => tariffs.id, { onDelete: "set null" }),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date"),
  autoRenew: boolean("auto_renew").notNull().default(true),
  metadata: text("metadata").default("{}"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  tariff: one(tariffs, { fields: [subscriptions.tariffId], references: [tariffs.id] }),
}));

export const promoCodes = pgTable("promo_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  discountType: varchar("discount_type", { length: 50 }).notNull().default("percent"),
  discountValue: integer("discount_value").notNull().default(0),
  maxUses: integer("max_uses").default(0),
  currentUses: integer("current_uses").notNull().default(0),
  minAmount: integer("min_amount").default(0),
  appliesToTariffs: text("applies_to_tariffs").default("[]"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const promoCodesRelations = relations(promoCodes, () => ({}));

export const adminRegistry = pgTable("admin_registry", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 100 }).notNull(),
  key: varchar("key", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }).default("📦"),
  config: text("config").default("{}"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  isBuiltin: boolean("is_builtin").notNull().default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminRegistryRelations = relations(adminRegistry, () => ({}));

export const systemSettings = pgTable("system_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull().default(""),
  type: varchar("type", { length: 20 }).notNull().default("string"),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const systemSettingsRelations = relations(systemSettings, () => ({}));

// ── Block 66 — Support, Community & Feedback ──

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }).notNull().default("general"),
  priority: varchar("priority", { length: 20 }).notNull().default("normal"),
  status: varchar("status", { length: 30 }).notNull().default("open"),
  attachment: text("attachment"),
  logData: text("log_data"),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  user: one(users, { fields: [supportTickets.userId], references: [users.id] }),
  assignee: one(users, { fields: [supportTickets.assignedTo], references: [users.id] }),
  messages: many(supportMessages),
}));

export const supportMessages = pgTable("support_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supportMessagesRelations = relations(supportMessages, ({ one }) => ({
  ticket: one(supportTickets, { fields: [supportMessages.ticketId], references: [supportTickets.id] }),
  user: one(users, { fields: [supportMessages.userId], references: [users.id] }),
}));

export const feedback = pgTable("feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 30 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description"),
  screenshot: text("screenshot"),
  logData: text("log_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const feedbackRelations = relations(feedback, ({ one }) => ({
  user: one(users, { fields: [feedback.userId], references: [users.id] }),
}));

export const featureRequests = pgTable("feature_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).default("general"),
  status: varchar("status", { length: 30 }).notNull().default("new"),
  voteCount: integer("vote_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const featureRequestsRelations = relations(featureRequests, ({ one, many }) => ({
  user: one(users, { fields: [featureRequests.userId], references: [users.id] }),
  votes: many(featureVotes),
}));

export const featureVotes = pgTable("feature_votes", {
  id: uuid("id").defaultRandom().primaryKey(),
  featureRequestId: uuid("feature_request_id").notNull().references(() => featureRequests.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const featureVotesRelations = relations(featureVotes, ({ one }) => ({
  featureRequest: one(featureRequests, { fields: [featureVotes.featureRequestId], references: [featureRequests.id] }),
  user: one(users, { fields: [featureVotes.userId], references: [users.id] }),
}));

// ── Block 67 — Publish & Deploy ──

export const publishLinks = pgTable("publish_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  url: text("url").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  passwordHash: text("password_hash"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const publishLinksRelations = relations(publishLinks, ({ one }) => ({
  project: one(projects, { fields: [publishLinks.projectId], references: [projects.id] }),
  user: one(users, { fields: [publishLinks.userId], references: [users.id] }),
}));

export const projectDeployConfigs = pgTable("project_deploy_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().unique().references(() => projects.id, { onDelete: "cascade" }),
  target: varchar("target", { length: 30 }).notNull().default("vps"),
  branch: varchar("branch", { length: 100 }).notNull().default("main"),
  buildCommand: text("build_command"),
  outputDir: varchar("output_dir", { length: 255 }).default("dist"),
  rootDir: varchar("root_dir", { length: 255 }).default("/"),
  envOverride: text("env_override"),
  autoDeploy: boolean("auto_deploy").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectDeployConfigsRelations = relations(projectDeployConfigs, ({ one }) => ({
  project: one(projects, { fields: [projectDeployConfigs.projectId], references: [projects.id] }),
}));

export const deployProviderSettings = pgTable("deploy_provider_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: varchar("provider_id", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 10 }).default("🚀"),
  color: varchar("color", { length: 7 }).default("#6366f1"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  configSchema: text("config_schema"),
  minTariff: varchar("min_tariff", { length: 30 }).default("free"),
  maxDeploys: integer("max_deploys").default(-1),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deployProviderSettingsRelations = relations(deployProviderSettings, () => ({}));

// ── Marketplace Core (Block 70) ──

export const marketplaceCorePackages = pgTable("marketplace_core_packages", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  listing: jsonb("listing").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const marketplaceCorePackagesRelations = relations(marketplaceCorePackages, () => ({}));

export const marketplaceCoreReviews = pgTable("marketplace_core_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  packageId: uuid("package_id").notNull().references(() => marketplaceCorePackages.id, { onDelete: "cascade" }),
  review: jsonb("review").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const marketplaceCoreReviewsRelations = relations(marketplaceCoreReviews, ({ one }) => ({
  package: one(marketplaceCorePackages, { fields: [marketplaceCoreReviews.packageId], references: [marketplaceCorePackages.id] }),
}));

export const marketplaceCoreCreators = pgTable("marketplace_core_creators", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  profile: jsonb("profile").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const marketplaceCoreCreatorsRelations = relations(marketplaceCoreCreators, () => ({}));

export const marketplaceCorePayments = pgTable("marketplace_core_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  payment: jsonb("payment").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const marketplaceCorePaymentsRelations = relations(marketplaceCorePayments, () => ({}));

export const marketplaceCoreEvents = pgTable("marketplace_core_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  event: jsonb("event").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const marketplaceCoreEventsRelations = relations(marketplaceCoreEvents, () => ({}));

// ── Universal Connections (Block 71) ──

export const connectionInstances = pgTable("connection_instances", {
  id: uuid("id").defaultRandom().primaryKey(),
  instance: jsonb("instance").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const connectionInstancesRelations = relations(connectionInstances, () => ({}));

export const connectionEvents = pgTable("connection_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  event: jsonb("event").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const connectionEventsRelations = relations(connectionEvents, () => ({}));

// ── Verification (Block 73) ──

export const verificationTasks = pgTable("verification_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: varchar("session_id", { length: 255 }).notNull().unique(),
  proof: jsonb("proof").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verificationTasksRelations = relations(verificationTasks, () => ({}));

// ── Global App State Persistence (Block 74) ──

export const userAppState = pgTable("user_app_state", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  state: jsonb("state").notNull().default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userAppStateRelations = relations(userAppState, ({ one }) => ({
  user: one(users, { fields: [userAppState.userId], references: [users.id] }),
}));
