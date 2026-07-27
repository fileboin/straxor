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
