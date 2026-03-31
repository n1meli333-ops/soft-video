import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateVideoPrompts } from "@/lib/gemini";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fragmentId: string }> }
) {
  const { id, fragmentId } = await params;
  const body = await req.json();

  const fragment = await prisma.fragment.findUnique({
    where: { id: fragmentId },
  });

  if (!fragment || fragment.projectId !== id) {
    return NextResponse.json({ error: "Fragment not found" }, { status: 404 });
  }

  try {
    const regeneratePrompt = body.regeneratePrompt || "Rewrite this video prompt to avoid content policy issues while keeping the same visual intent. Make it safe for AI video generation.";

    const prompts = await generateVideoPrompts({
      transcriptText: fragment.prompt,
      timestampsJson: "[]",
      specialPrompt: regeneratePrompt,
      aiProvider: body.aiProvider || "gemini",
      aiModel: body.aiModel || undefined,
      batchSize: 1,
    });

    const newPrompt = prompts[0] || fragment.prompt;

    await prisma.fragment.update({
      where: { id: fragmentId },
      data: {
        prompt: newPrompt,
        status: "pending",
        videoPath: null,
        thumbnailPath: null,
      },
    });

    return NextResponse.json({ prompt: newPrompt, status: "pending" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Regeneration failed";
    console.error("Regeneration error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
