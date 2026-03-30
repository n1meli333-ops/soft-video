import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureProjectDir } from "@/lib/utils";
import { getAudioDuration } from "@/lib/ffmpeg";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const formData = await req.formData();
    const file = formData.get("audio") as File;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const projectDir = await ensureProjectDir(id);
    const ext = path.extname(file.name) || ".mp3";
    const audioPath = path.join(projectDir, `audio${ext}`);

    const bytes = await file.arrayBuffer();
    await writeFile(audioPath, Buffer.from(bytes));

    let duration = 0;
    try {
      duration = await getAudioDuration(audioPath);
    } catch (e) {
      console.warn("Could not get audio duration:", e);
    }

    await prisma.project.update({
      where: { id },
      data: { audioPath, audioDuration: duration },
    });

    return NextResponse.json({ audioPath, duration });
  } catch (error) {
    console.error("Audio upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
