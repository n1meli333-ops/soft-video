import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renderVideo } from "@/lib/ffmpeg";
import { getProjectDir } from "@/lib/utils";
import path from "path";

export async function POST(req: NextRequest) {
  const { projectId } = await req.json();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      fragments: {
        where: { status: "completed" },
        orderBy: { index: "asc" },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.audioPath) {
    return NextResponse.json({ error: "No audio file" }, { status: 400 });
  }

  if (project.fragments.length === 0) {
    return NextResponse.json({ error: "No completed fragments" }, { status: 400 });
  }

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "rendering" },
    });

    const projectDir = getProjectDir(projectId);
    const outputPath = path.join(projectDir, "output.mp4");
    const fragmentPaths = project.fragments
      .filter((f) => f.videoPath)
      .map((f) => f.videoPath!);

    await renderVideo(projectDir, project.audioPath, fragmentPaths, outputPath);

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "completed" },
    });

    return NextResponse.json({ outputPath, status: "completed" });
  } catch (error) {
    console.error("Render error:", error);
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "ready" },
    });
    return NextResponse.json({ error: "Render failed" }, { status: 500 });
  }
}
