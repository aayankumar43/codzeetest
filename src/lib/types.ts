export interface HarnessSettings {
  ollamaUrl: string;
  model: string;
  temperature: number;
  topP: number;
  numCtx: number;
  numPredict: number;
  think: boolean;
  systemPrompt: string;
  maxToolSteps: number;
  contextMessages: number;
  commandTimeoutMs: number;
  maxToolOutputChars: number;
  workspaceDir: string;
  allowShell: boolean;
  plugins: Record<string, boolean>;
  activeSkills: string[]; // skill ids injected into the system prompt
}

export interface ToolInfo {
  name: string;
  description: string;
}

export interface ModelInfo {
  name: string;
  size: number;
  digest?: string;
  modified_at: string;
  details?: {
    format?: string;
    family?: string;
    family_name?: string;
    parameter_size?: string;
    quantization_level?: string;
    context_length?: number;
  };
}

export interface LoadedModelInfo {
  name: string;
  size: number;
  details?: { parameter_size?: string; context_length?: number };
  until?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  body: string;
  tools: string[];
  enabled: boolean;
  builtin: boolean;
}

export interface PluginInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  tools: ToolInfo[];
}

export interface HarnessInfo {
  ollama: {
    url: string;
    reachable: boolean;
    version?: string;
    error?: string;
    models: ModelInfo[];
    loaded: LoadedModelInfo[];
  };
  plugins: PluginInfo[];
  skills: Skill[];
  tools: ToolInfo[];
  availableTools: ToolInfo[];
  settings: HarnessSettings;
  workspace: string;
}

export interface Conversation {
  id: string;
  title: string;
  model: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: string;
  ok: boolean;
  ms: number;
  truncated?: boolean;
}

export interface AssistantMeta {
  toolCalls?: ToolCallRecord[];
  promptTokens?: number;
  completionTokens?: number;
  totalMs?: number;
  steps?: number;
  aborted?: boolean;
}

export interface MessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta: AssistantMeta | null;
  createdAt: string;
}

export type AgentEvent =
  | { type: "delta"; content: string }
  | { type: "tool_start"; id: number; name: string; args: Record<string, unknown> }
  | {
      type: "tool_end";
      id: number;
      name: string;
      result: string;
      ok: boolean;
      ms: number;
      truncated?: boolean;
    }
  | {
      type: "done";
      content: string;
      toolCalls: ToolCallRecord[];
      steps: number;
      aborted?: boolean;
      promptTokens?: number;
      completionTokens?: number;
      totalMs?: number;
    }
  | { type: "error"; message: string };
