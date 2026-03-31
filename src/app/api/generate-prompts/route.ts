import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateVideoPrompts } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const { projectId, specialPrompt, aiProvider, aiModel } = await req.json();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project?.transcriptTxt || !project?.transcriptJson) {
    return NextResponse.json({ error: "No transcription found. Transcribe audio first." }, { status: 400 });
  }

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "generating" },
    });

    const prompts = await generateVideoPrompts({
      transcriptText: project.transcriptTxt,
      timestampsJson: project.transcriptJson,
      specialPrompt: specialPrompt || "",
      aiProvider: aiProvider || "gemini",
      aiModel: aiModel || undefined,
    });

    // Create fragments in DB
    await prisma.fragment.deleteMany({ where: { projectId } });
    await prisma.fragment.createMany({
      data: prompts.map((prompt, index) => ({
        projectId,
        index,
        prompt,
        status: "pending",
      })),
    });

    await prisma.project.update({
      where: { id: projectId },
      data: {
        prompts: JSON.stringify(prompts),
        promptCount: prompts.length,
        status: "ready",
      },
    });

    return NextResponse.json({ prompts, count: prompts.length });
  } catch (error) {
    console.error("Prompt generation error:", error);
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "draft" },
    });
    return NextResponse.json({ error: "Prompt generation failed" }, { status: 500 });
  }
}
