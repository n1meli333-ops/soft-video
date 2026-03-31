import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { transcribeAudio } from "@/lib/assemblyai";
import { generateVideoPrompts } from "@/lib/gemini";
import { ensureProjectDir } from "@/lib/utils";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { specialPrompt, aiProvider, aiModel } = body;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project?.audioPath) {
    return NextResponse.json({ error: "No audio file" }, { status: 400 });
  }

  try {
    // Step 1: Transcribe
    await prisma.project.update({
      where: { id },
      data: { status: "transcribing" },
    });

    const transcriptResult = await transcribeAudio(project.audioPath);
    const projectDir = await ensureProjectDir(id);

    await writeFile(path.join(projectDir, "transcript.txt"), transcriptResult.text, "utf-8");
    await writeFile(path.join(projectDir, "timestamps.json"), JSON.stringify(transcriptResult.timestamps, null, 2), "utf-8");

    await prisma.project.update({
      where: { id },
      data: {
        transcriptTxt: transcriptResult.text,
        transcriptJson: JSON.stringify(transcriptResult.timestamps),
      },
    });

    // Step 2: Generate prompts
    await prisma.project.update({
      where: { id },
      data: { status: "generating" },
    });

    const prompts = await generateVideoPrompts({
      transcriptText: transcriptResult.text,
      timestampsJson: JSON.stringify(transcriptResult.timestamps),
      specialPrompt: specialPrompt || "",
      aiProvider: aiProvider || "gemini",
      aiModel: aiModel || undefined,
    });

    await prisma.fragment.deleteMany({ where: { projectId: id } });
    await prisma.fragment.createMany({
      data: prompts.map((prompt, index) => ({
        projectId: id,
        index,
        prompt,
        status: "pending",
      })),
    });

    await prisma.project.update({
      where: { id },
      data: {
        prompts: JSON.stringify(prompts),
        promptCount: prompts.length,
        status: "ready",
      },
    });

    return NextResponse.json({
      status: "ready",
      transcription: { text: transcriptResult.text, wordCount: transcriptResult.timestamps.length },
      prompts: { count: prompts.length },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Pipeline failed";
    console.error("Pipeline error:", error);
    await prisma.project.update({
      where: { id },
      data: { status: "failed" },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
