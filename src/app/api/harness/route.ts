import { db } from "@/db";
import { skills } from "@/db/schema";
import { ensureSeed } from "@/db/seed";
import { getSettings } from "@/lib/harness/config";
import { PLUGINS } from "@/lib/harness/plugins";
import { TOOLS, activeTools, resolveWorkspace } from "@/lib/harness/tools";
import { listModels, loadedModels, ollamaStatus } from "@/lib/harness/ollama";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  const settings = await getSettings();
  const status = await ollamaStatus(settings);
  let models: Awaited<ReturnType<typeof listModels>> = [];
  let loaded: Awaited<ReturnType<typeof loadedModels>> = [];
  if (status.reachable) {
    try {
      models = await listModels(settings);
    } catch {
      models = [];
    }
    try {
      loaded = await loadedModels(settings);
    } catch {
      loaded = [];
    }
  }
  const skillRows = await db.select().from(skills);
  const plugins = PLUGINS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    enabled: !!settings.plugins[p.id],
    tools: p.tools
      .map((t) => TOOLS.find((x) => x.name === t))
      .filter(Boolean)
      .map((t) => ({ name: t!.name, description: t!.description })),
  }));
  return Response.json({
    ollama: {
      url: settings.ollamaUrl,
      reachable: status.reachable,
      version: status.version,
      error: status.error,
      models,
      loaded,
    },
    plugins,
    skills: skillRows.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      body: s.body,
      tools: s.tools,
      enabled: s.enabled,
      builtin: s.builtin,
    })),
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    availableTools: activeTools(settings).map((t) => ({
      name: t.name,
      description: t.description,
    })),
    settings,
    workspace: resolveWorkspace(settings),
  });
}
