import { NextResponse } from "next/server";
import { db } from "@/db";
import { conversations, messages, skills, models } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runSkillChat } from "@/lib/skills";

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const { message, conversationId, skillId, modelId, systemPrompt } = b;
    if (!message) return NextResponse.json({ ok: false, error: "message required" }, { status: 400 });

    let convoId = conversationId;
    if (!convoId) {
      // Create new conversation
      const [c] = await db.insert(conversations).values({
        title: message.slice(0, 80),
        skillId: skillId || null,
        modelId: modelId || null,
        systemPrompt: systemPrompt || null,
      }).returning();
      convoId = c.id;
    }

    const [userMsg] = await db.insert(messages).values({
      conversationId: convoId,
      role: "user",
      content: message,
    }).returning();

    let skillRow = null;
    let modelRow = null;

    if (skillId) {
      const s = await db.select().from(skills).where(eq(skills.id, skillId)).limit(1).then(r => r[0]);
      if (s) skillRow = s;
    }

    if (modelId && !skillRow) {
      modelRow = await db.select().from(models).where(eq(models.id, modelId)).limit(1).then(r => r[0] || null);
    }

    let assistantContent = "";
    let assistantMsg: any = null;
    let toolResults: any[] = [];

    if (skillRow) {
      const prev = await db.select().from(messages).where(eq(messages.conversationId, convoId)).orderBy(messages.createdAt);
      const hist = prev.map((m: any) => ({ role: m.role as any, content: m.content }));
      const result = await runSkillChat(skillRow.id, hist, convoId);
      assistantContent = result.response.content || "";
      assistantMsg = result.response;
      // Insert assistant message with tool results if any
      const toolResultsData = (result.messages || []).filter((m: any) => m.role === "tool").map((m: any) => ({
        tool_call_id: m.tool_call_id,
        name: m.name,
        content: m.content,
      }));
      toolResults = toolResultsData;
    } else {
      // Direct model chat
      const prev = await db.select().from(messages).where(eq(messages.conversationId, convoId)).orderBy(messages.createdAt);
      const hist = prev.map((m: any) => ({ role: m.role as any, content: m.content }));

      // Check if Omniroute, OpenRouter, or Ollama
      if (modelRow?.source === "omniroute" && modelRow.omnirouteModelId) {
        const { chatOmniroute, getOmnirouteConfig } = await import("@/lib/omniroute");
        const orCfg = await getOmnirouteConfig();
        const res = await chatOmniroute({
          model: modelRow.omnirouteModelId,
          messages: hist.map(m => ({ role: m.role as any, content: m.content })),
          stream: false,
        }, orCfg);
        assistantContent = res.choices?.[0]?.message?.content || "";
        assistantMsg = { role: "assistant", content: assistantContent };
      } else if (modelRow?.source === "openrouter" && modelRow.openrouterModelId) {
        const { chatOpenRouter, getOpenRouterConfig } = await import("@/lib/openrouter");
        const opCfg = await getOpenRouterConfig();
        const res = await chatOpenRouter({
          model: modelRow.openrouterModelId,
          messages: hist.map(m => ({ role: m.role as any, content: m.content })),
          stream: false,
        }, opCfg);
        assistantContent = res.choices?.[0]?.message?.content || "";
        assistantMsg = { role: "assistant", content: assistantContent };
      } else {
        const targetModel = modelRow?.ollamaName || (process.env.DEFAULT_MODEL || "llama3");
        const { chatOllama, getOllamaConfig } = await import("@/lib/ollama");
        const cfg = await getOllamaConfig();
        const res = await chatOllama({ model: targetModel, messages: hist, stream: false }, cfg);
        assistantContent = res.message?.content || res.response || "";
        assistantMsg = res.message || res;
      }
    }

    const [assistantDb] = await db.insert(messages).values({
      conversationId: convoId,
      role: "assistant",
      content: assistantContent,
      toolResults: toolResults.length ? toolResults : null,
    }).returning();

    await db.update(conversations).set({ updatedAt: new Date(), title: conversationId ? undefined : message.slice(0, 80) }).where(eq(conversations.id, convoId));

    return NextResponse.json({
      ok: true,
      conversationId: convoId,
      userMessage: userMsg,
      assistantMessage: assistantDb,
      response: assistantContent,
      toolResults,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message || String(e) }, { status: 500 });
  }
}
