import { abortAgent } from "@/lib/harness/agent";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let conversationId = "";
  try {
    const body = (await req.json()) as { conversationId?: string };
    conversationId = body.conversationId ?? "";
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const stopped = abortAgent(conversationId);
  return Response.json({ ok: true, stopped });
}
