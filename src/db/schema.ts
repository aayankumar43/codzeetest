import {
  pgTable,
  serial,
  text,
  varchar,
  boolean,
  jsonb,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";

export const modelSourceEnum = pgEnum("model_source", ["ollama", "omniroute", "openrouter"]);
export const modelStatusEnum = pgEnum("model_status", [
  "available",
  "downloading",
  "error",
  "not_found",
]);

export const skillStatusEnum = pgEnum("skill_status", [
  "active", "draft", "archived"]);

export const pluginStatusEnum = pgEnum("plugin_status", [
  "enabled",
  "disabled",
  "error",
]);

export const toolStatusEnum = pgEnum("tool_status", [
  "connected",
  "disconnected",
  "error",
]);

export const models = pgTable("models", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  ollamaName: varchar("ollama_name", { length: 128 }),
  omnirouteModelId: varchar("omniroute_model_id", { length: 256 }),
  openrouterModelId: varchar("openrouter_model_id", { length: 256 }),
  displayName: varchar("display_name", { length: 256 }),
  description: text("description"),
  tag: varchar("tag", { length: 64 }),
  source: modelSourceEnum("source").default("ollama"),
  params: jsonb("params").default({ temperature: 0.7, top_p: 0.9 }),
  status: modelStatusEnum("status").default("not_found"),
  size: varchar("size", { length: 32 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const tools = pgTable("tools", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description"),
  endpoint: varchar("endpoint", { length: 512 }),
  method: varchar("method", { length: 16 }).default("GET"),
  authType: varchar("auth_type", { length: 32 }).default("none"),
  authConfig: jsonb("auth_config").default({}),
  headers: jsonb("headers").default({}),
  schema: jsonb("schema").default({}),
  status: toolStatusEnum("status").default("disconnected"),
  lastPing: timestamp("last_ping", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const plugins = pgTable("plugins", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  version: varchar("version", { length: 32 }).default("1.0.0"),
  description: text("description"),
  source: varchar("source", { length: 256 }),
  config: jsonb("config").default({}),
  skills: jsonb("skills").default([]),
  status: pluginStatusEnum("status").default("disabled"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const skills = pgTable("skills", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description"),
  promptTemplate: text("prompt_template"),
  modelId: integer("model_id").references(() => models.id),
  toolIds: jsonb("tool_ids").default([]),
  pluginIds: jsonb("plugin_ids").default([]),
  parameters: jsonb("parameters").default({}),
  status: skillStatusEnum("status").default("draft"),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 256 }),
  skillId: integer("skill_id").references(() => skills.id),
  modelId: integer("model_id").references(() => models.id),
  systemPrompt: text("system_prompt"),
  context: jsonb("context").default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 16 }).notNull(),
  content: text("content").notNull(),
  toolCalls: jsonb("tool_calls").default([]),
  toolResults: jsonb("tool_results").default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const mcpServers = pgTable("mcp_servers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  command: varchar("command", { length: 256 }).notNull(),
  args: jsonb("args").default([]),
  env: jsonb("env").default({}),
  transport: varchar("transport", { length: 32 }).default("stdio"),
  url: varchar("url", { length: 512 }),
  status: varchar("status", { length: 16 }).default("disconnected"),
  lastPing: timestamp("last_ping", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const triggerModeEnum = pgEnum("trigger_mode", ["manual", "scheduled", "webhook"]);
export const agentStatusEnum = pgEnum("agent_status", ["active", "paused", "disabled"]);
export const executionStatusEnum = pgEnum("execution_status", ["running", "completed", "failed", "stopped"]);

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description"),
  requirements: text("requirements"),
  flowMode: varchar("flow_mode", { length: 16 }).default("manual"),
  status: varchar("status", { length: 16 }).default("active"),
  nodes: jsonb("nodes").default([]),
  edges: jsonb("edges").default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const projectChats = pgTable("project_chats", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  nodeId: varchar("node_id", { length: 64 }),
  role: varchar("role", { length: 16 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description"),
  systemPrompt: text("system_prompt"),
  modelId: integer("model_id").references(() => models.id),
  skillId: integer("skill_id").references(() => skills.id),
  toolIds: jsonb("tool_ids").default([]),
  pluginIds: jsonb("plugin_ids").default([]),
  mcpServerIds: jsonb("mcp_server_ids").default([]),
  triggerMode: triggerModeEnum("trigger_mode").default("manual"),
  scheduleCron: varchar("schedule_cron", { length: 64 }),
  webhookUrl: varchar("webhook_url", { length: 512 }),
  maxIterations: integer("max_iterations").default(10),
  timeoutMs: integer("timeout_ms").default(60000),
  parameters: jsonb("parameters").default({ temperature: 0.7, top_p: 0.9, max_tokens: 1024 }),
  status: agentStatusEnum("status").default("disabled"),
  executionCount: integer("execution_count").default(0),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const agentExecutions = pgTable("agent_executions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  input: text("input"),
  output: text("output"),
  steps: jsonb("steps").default([]),
  status: executionStatusEnum("status").default("running"),
  durationMs: integer("duration_ms"),
  iterationCount: integer("iteration_count").default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const appConfig = pgTable("app_config", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const toolExecutions = pgTable("tool_executions", {
  id: serial("id").primaryKey(),
  toolId: integer("tool_id").notNull().references(() => tools.id),
  conversationId: integer("conversation_id").references(() => conversations.id),
  messageId: integer("message_id").references(() => messages.id),
  requestPayload: jsonb("request_payload").default({}),
  responsePayload: jsonb("response_payload").default({}),
  status: varchar("status", { length: 16 }).default("pending"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
