import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, projectChats, agents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createAgent, listAgents } from "@/lib/agents";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const chatsFor = url.searchParams.get("chatsFor");

  if (chatsFor) {
    const chats = await db.select().from(projectChats)
      .where(eq(projectChats.projectId, parseInt(chatsFor)))
      .orderBy(projectChats.createdAt);
    return NextResponse.json({ ok: true, chats });
  }

  if (id) {
    const [p] = await db.select().from(projects).where(eq(projects.id, parseInt(id))).limit(1);
    if (!p) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, project: p });
  }

  const list = await db.select().from(projects).orderBy(desc(projects.updatedAt));
  return NextResponse.json({ ok: true, projects: list });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action || "create";

  if (action === "create") {
    const [p] = await db.insert(projects).values({
      name: body.name || "New Project",
      slug: body.slug || `project-${Date.now()}`,
      description: body.description || "",
      requirements: body.requirements || "",
      flowMode: body.flowMode || "manual",
      nodes: [],
      edges: [],
    }).returning();
    return NextResponse.json({ ok: true, project: p });
  }

  if (action === "autoFlow") {
    // Build an auto flow from requirements
    const projectId = body.projectId;
    const requirements = body.requirements || "";
    const agentList = await listAgents();

    // Simple keyword matching for auto agent selection
    const keywordMap: Record<string, string[]> = {
      coding: ["code", "coding", "program", "software", "implement", "build", "develop", "function", "class"],
      testing: ["test", "qa", "quality", "bug", "coverage", "assert", "spec", "unit"],
      review: ["review", "audit", "check", "analyze", "inspect", "feedback"],
      research: ["research", "search", "find", "look", "explore", "investigate"],
      design: ["design", "ui", "ux", "mock", "prototype", "wireframe", "figma"],
      database: ["database", "db", "sql", "query", "data", "schema", "table"],
      devops: ["deploy", "ci", "cd", "docker", "kubernetes", "pipeline", "infrastructure"],
      documentation: ["document", "docs", "readme", "guide", "manual", "write"],
      security: ["security", "secure", "vulnerability", "auth", "encryption", "ssl"],
      communication: ["communicate", "email", "slack", "message", "notify", "report"],
    };

    const reqLower = requirements.toLowerCase();
    const matchedAgents: typeof agentList = [];
    const categories: string[] = [];

    for (const [category, keywords] of Object.entries(keywordMap)) {
      if (keywords.some(k => reqLower.includes(k))) {
        categories.push(category);
        // Find matching agent by description or name containing the category
        const match = agentList.find(a =>
          (a.name || "").toLowerCase().includes(category) ||
          (a.description || "").toLowerCase().includes(category)
        );
        if (match && !matchedAgents.find(m => m.id === match.id)) {
          matchedAgents.push(match);
        }
      }
    }

    // If no categories matched, use a default "general" category
    if (categories.length === 0) {
      categories.push("general");
    }

    // For each matched category without an existing agent, create a default agent
    const defaultAgentTemplates: Record<string, { name: string; description: string; systemPrompt: string }> = {
      coding: {
        name: "Coding Agent",
        description: "Writes and implements code based on project requirements",
        systemPrompt: "You are a coding agent. Write clean, working code based on the requirements. Use available tools to execute code and verify output.",
      },
      testing: {
        name: "Testing Agent",
        description: "Creates and runs tests for code",
        systemPrompt: "You are a testing agent. Write comprehensive tests, run them, and report results. Focus on edge cases and error handling.",
      },
      review: {
        name: "Review Agent",
        description: "Reviews code for quality and issues",
        systemPrompt: "You are a code review agent. Analyze code for bugs, style issues, security concerns, and suggest improvements.",
      },
      research: {
        name: "Research Agent",
        description: "Researches topics and gathers information",
        systemPrompt: "You are a research agent. Search for information, summarize findings, and provide well-sourced answers.",
      },
      design: {
        name: "Design Agent",
        description: "Designs UI/UX and prototypes",
        systemPrompt: "You are a design agent. Create design specs, wireframes, and UI/UX recommendations.",
      },
      database: {
        name: "Database Agent",
        description: "Manages database schemas and queries",
        systemPrompt: "You are a database agent. Design schemas, write queries, optimize performance, and ensure data integrity.",
      },
      devops: {
        name: "DevOps Agent",
        description: "Manages deployment and infrastructure",
        systemPrompt: "You are a DevOps agent. Configure deployments, CI/CD pipelines, and infrastructure as code.",
      },
      documentation: {
        name: "Documentation Agent",
        description: "Writes project documentation",
        systemPrompt: "You are a documentation agent. Write clear, comprehensive documentation for code and systems.",
      },
      security: {
        name: "Security Agent",
        description: "Audits and improves security",
        systemPrompt: "You are a security agent. Identify vulnerabilities, recommend fixes, and audit security posture.",
      },
      communication: {
        name: "Communication Agent",
        description: "Handles messaging and notifications",
        systemPrompt: "You are a communication agent. Draft messages, manage notifications, and coordinate updates.",
      },
    };

    const createdAgentIds: number[] = [];
    for (const cat of categories) {
      if (!matchedAgents.find(a => (a.name || "").toLowerCase().includes(cat))) {
        const template = defaultAgentTemplates[cat];
        if (template) {
          const newAgent = await createAgent({
            name: `${template.name} (${body.name})`,
            slug: `${cat}-agent-${Date.now()}`,
            description: template.description,
            systemPrompt: template.systemPrompt,
            status: "active",
          });
          createdAgentIds.push(newAgent.id);
          matchedAgents.push(newAgent);
        }
      }
    }

    // Build React Flow nodes (horizontal layout)
    const nodes = matchedAgents.map((a, i) => ({
      id: `agent-${a.id}`,
      type: "agentNode",
      position: { x: i * 280 + 50, y: 100 },
      data: { label: a.name, agentId: a.id, description: a.description, category: categories[i] || "general" },
    }));

    // Build edges (linear chain)
    const edges = nodes.slice(0, -1).map((n, i) => ({
      id: `e-${nodes[i].id}-${nodes[i + 1].id}`,
      source: n.id,
      target: nodes[i + 1].id,
      type: "smoothstep",
      animated: true,
      label: "flows to",
    }));

    await db.update(projects).set({
      nodes,
      edges,
      updatedAt: new Date(),
    }).where(eq(projects.id, projectId));

    return NextResponse.json({ ok: true, project: { ...body, nodes, edges }, createdAgents: createdAgentIds, categories });
  }

  if (action === "saveLayout") {
    const projectId = body.projectId;
    await db.update(projects).set({
      nodes: body.nodes || [],
      edges: body.edges || [],
      updatedAt: new Date(),
    }).where(eq(projects.id, projectId));
    return NextResponse.json({ ok: true });
  }

  if (action === "chat") {
    const projectId = body.projectId;
    const nodeId = body.nodeId;
    const message = body.message;
    if (!message) return NextResponse.json({ ok: false, error: "message required" }, { status: 400 });

    // Save user message
    await db.insert(projectChats).values({
      projectId,
      nodeId: nodeId || null,
      role: "user",
      content: message,
    });

    // Get agent info if nodeId provided
    let agentResponse = "";
    if (nodeId) {
      const agentIdMatch = nodeId.match(/agent-(\d+)/);
      const agentId = agentIdMatch ? parseInt(agentIdMatch[1]) : null;
      if (agentId) {
        const agent = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1).then(r => r[0]);
        if (agent) {
          // Simple response based on agent description - in real impl this would run the agent
          agentResponse = `[${agent.name}] Acknowledged. Current status: Active. I'm monitoring the ${body.projectName || "project"} and ready to execute tasks. Last activity: ${new Date().toLocaleString()}.`;
        } else {
          agentResponse = "Agent not found for this node.";
        }
      }
    } else {
      // Project-level chat
      const project = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1).then(r => r[0]);
      if (project) {
        const nodeCount = (project.nodes as any[]).length;
        agentResponse = `[PROJECT: ${project.name}] Project has ${nodeCount} agents in the workflow. Status: Active. Requirements: ${project.requirements?.slice(0, 100) || "none"}...`;
      }
    }

    // Save assistant response
    await db.insert(projectChats).values({
      projectId,
      nodeId: nodeId || null,
      role: "assistant",
      content: agentResponse,
    });

    return NextResponse.json({ ok: true, response: agentResponse });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.id) {
    await db.update(projects).set({ ...body, updatedAt: new Date() }).where(eq(projects.id, body.id));
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.id) await db.delete(projects).where(eq(projects.id, body.id));
  return NextResponse.json({ ok: true });
}
