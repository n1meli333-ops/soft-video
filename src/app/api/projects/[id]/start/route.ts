import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project?.audioPath) {
    return NextResponse.json({ error: "No audio file" }, { status: 400 });
  }

  // Set project to transcribing stage — the background worker will pick it up
  await prisma.project.update({
    where: { id },
    data: {
      status: "transcribing",
      currentStage: "transcribing",
      progress: 0,
      statusMessage: "Starting pipeline...",
      errorMessage: null,
    },
  });

  await prisma.activity.create({
    data: {
      projectId: id,
      type: "info",
      stage: "transcribing",
      message: "Pipeline started — transcribing audio",
    },
  });

  return NextResponse.json({ status: "started" });
}
