# Ollama Harness

A fully workable, configurable local AI harness connecting **Ollama** models with **tools**, **plugins**, **skills**, and **MCP (Model Context Protocol)** servers.

Built with **Next.js App Router**, **PostgreSQL** via **Drizzle ORM**, and real REST connections — not a simulation.

---

## What It Does

- **Local Inference** — Connects to your local Ollama instance (`localhost:11434`) to run models (Llama, Mistral, Qwen, etc.).
- **Tool Connector** — Register external APIs/endpoints (weather, DB, search, custom services) with auth, headers, and JSON schemas. Tools are executed live during inference.
- **Plugins** — Load extensions that provide capabilities and link to skills.
- **Skills** — Compose a model + selected tools + plugins into reusable inference workflows with custom system prompts.
- **MCP Servers** — Connect Model Context Protocol servers (stdio or SSE) to expose extra tools/resources to the harness.
- **Real Chat** — Persistent conversations with assistant responses, tool result display, and history stored in PostgreSQL.

---

## Project Layout

| Path | Purpose |
|---|---|
| `src/app/page.tsx` | Dashboard overview |
| `src/app/chat/page.tsx` | Live chat with model/skill selection |
| `src/app/models/page.tsx` | Manage linked Ollama models (pull/delete) |
| `src/app/tools/page.tsx` | Connect and test external tool endpoints |
| `src/app/plugins/page.tsx` | Create/toggle plugins |
| `src/app/skills/page.tsx` | Build skills from model + tools + plugins |
| `src/app/mcp/page.tsx` | Register and connect MCP servers |
| `src/app/settings/page.tsx` | Configure Ollama host and verify connection |
| `src/lib/ollama.ts` | Ollama REST client (chat, generate, tags, pull, delete) |
| `src/lib/tools.ts` | Tool execution engine with auth and DB logging |
| `src/lib/plugins.ts` | Plugin loader / registry |
| `src/lib/skills.ts` | Skill orchestration with prompt building and tool loops |
| `src/lib/mcp.ts` | MCP client (connect, list tools, call) |
| `src/db/schema.ts` | Database schema (models, tools, plugins, skills, conversations, messages, tool_executions, mcp_servers, app_config) |
| `src/app/api/` | Server routes for all features |

---

## Key Features

### Models
- Register Ollama model names with display names, tags, and parameters (`temperature`, `top_p`).
- View detected Ollama status and pull/update or delete directly.

### Tools
- Configure endpoint URL, HTTP method, auth type (none / bearer / api_key), headers, and JSON schema.
- Tools are executed in real time during chat; results feed back into the conversation.
- All executions logged to `tool_executions`.

### Plugins
- Built-in plugins seeded: `system-admin`, `code-craft`, `db-connector`, `web-search`.
- Toggle enabled/disabled and link to skills.

### Skills
- Built-in skills seeded: `system-audit`, `file-manager`, `code-review`, `code-gen`, `query-builder`.
- Each skill links to a model, specific tools, plugins, and a prompt template.
- Usage counted automatically.

### MCP Servers
- Register MCP server configs (command, args, env, transport: stdio / sse).
- Connect to discover available tools.
- Use discovered tools in chat flows.

### Chat
- Choose direct model or a composed skill.
- Messages persisted with full history.
- Tool results shown inline when the model invokes functions.
- Supports multi-turn with tool result loops.

### Configurable
- Ollama host stored in `app_config` table and editable via `/settings`.
- All settings persist across restarts.

---

## Database (Drizzle + PostgreSQL)

Connection via `DATABASE_URL` in `.env` (default: `postgresql://postgres:postgres@127.0.0.1:5432/app_db`).

Key tables:
- `models`
- `tools`
- `plugins`
- `skills`
- `conversations`
- `messages`
- `tool_executions`
- `mcp_servers`
- `app_config`

Apply schema updates with:
```bash
npx drizzle-kit push
```

---

## Setup

1. **Requirements**
   - Node.js / npm
   - PostgreSQL running locally (or via Docker)
   - Ollama running locally (`ollama serve` on `localhost:11434`)

2. **Install**
   ```bash
   npm install
   ```

3. **Environment**
   The `.env` file already points to the local database:
   ```
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
   ```

4. **Database**
   ```bash
   npx drizzle-kit push
   ```

5. **Run**
   ```bash
   npm run dev
   # or production
   npm run build && npm start
   ```

---

## MCP Server Example

To connect an MCP server (e.g., filesystem or database server):

1. Go to `/mcp`
2. Add a server, e.g.:
   - Name: `Filesystem`
   - Command: `npx`
   - Args: `["-y", "@modelcontextprotocol/server-filesystem", "/path"]`
   - Transport: `stdio`
3. Click **Connect** to discover tools.
4. Use those tools in skills/chat.

---

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/ollama/status` | GET | Detect local Ollama |
| `/api/models` | GET/POST/PUT/DELETE | Manage models |
| `/api/tools` | GET/POST/PUT/DELETE | Manage tools |
| `/api/plugins` | GET/POST/PUT/DELETE | Manage plugins |
| `/api/skills` | GET/POST/PUT/DELETE | Manage skills |
| `/api/chat` | POST | Send message (direct or skill) |
| `/api/conversations` | GET | Load conversation history |
| `/api/mcp` | GET/POST/PUT/DELETE | Manage MCP servers |
| `/api/settings` | GET/POST | Configure harness / Ollama host |

---

## Built With

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS v4
- PostgreSQL + Drizzle ORM
- `@modelcontextprotocol/sdk`
- Lucide icons

---

## Notes

- All inference runs locally through your Ollama instance. No external LLM APIs are required.
- Tools call the endpoints **you** configure; nothing is mocked.
- MCP integration connects to real MCP servers via stdio/SSE.
- The harness is designed to grow — add more skills, plugins, and MCP servers as your workflow expands.
