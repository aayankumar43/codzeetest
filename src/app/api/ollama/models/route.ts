import { ensureSeed } from "@/db/seed";
import { getSettings } from "@/lib/harness/config";
import {
  deleteModel,
  listModels,
  OllamaError,
  pullModel,
} from "@/lib/harness/ollama";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  await ensureSeed();
  const settings = await getSettings();
  try {
    const models = await listModels(settings);
    return Response.json({ models });
  } catch (e) {
    return Response.json({
      models: [],
      error: e instanceof OllamaError ? e.message : (e as Error).message,
    });
  }
}

export async function POST(req: Request) {
  await ensureSeed();
  const settings = await getSettings();
  let name = "";
  try {
    const body = (await req.json()) as { name?: string };
    name = (body.name ?? "").trim();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9._\/:-]+$/.test(name)) {
    return Response.json({ error: "Invalid model name" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const send = (obj: unknown) => encoder.encode(JSON.stringify(obj) + "\n");

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await pullModel(
          settings,
          name,
          (p) => {
            controller.enqueue(
              send({
                type: "progress",
                status: p.status,
                digest: p.digest,
                completed: p.completed,
                total: p.total,
              })
            );
          }
        );
        controller.enqueue(send({ type: "done", name }));
      } catch (e) {
        const msg = e instanceof OllamaError ? e.message : (e as Error).message;
        if ((e as Error).name !== "AbortError") {
          controller.enqueue(send({ type: "error", message: msg }));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}

export async function DELETE(req: Request) {
  await ensureSeed();
  const settings = await getSettings();
  let name = "";
  try {
    const body = (await req.json()) as { name?: string };
    name = (body.name ?? "").trim();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });
  try {
    await deleteModel(settings, name);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof OllamaError ? e.message : (e as Error).message },
      { status: 502 }
    );
  }
}
