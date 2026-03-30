import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { transcribeAudio } from "@/lib/assemblyai";
import { ensureProjectDir } from "@/lib/utils";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const { projectId } = await req.json();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project?.audioPath) {
    return NextResponse.json({ error: "No audio file found" }, { status: 400 });
  }

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "transcribing" },
    });

    const result = await transcribeAudio(project.audioPath);
    const projectDir = await ensureProjectDir(projectId);

    // Save transcript files
    const txtPath = path.join(projectDir, "transcript.txt");
    const jsonPath = path.join(projectDir, "timestamps.json");

    await writeFile(txtPath, result.text, "utf-8");
    await writeFile(jsonPath, JSON.stringify(result.timestamps, null, 2), "utf-8");

    await prisma.project.update({
      where: { id: projectId },
      data: {
        transcriptTxt: result.text,
        transcriptJson: JSON.stringify(result.timestamps),
        status: "draft",
      },
    });

    return NextResponse.json({
      text: result.text,
      timestamps: result.timestamps,
      wordCount: result.timestamps.length,
    });
  } catch (error) {
    console.error("Transcription error:", error);
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "draft" },
    });
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
