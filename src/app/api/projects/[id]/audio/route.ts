import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureProjectDir } from "@/lib/utils";
import { getAudioDuration } from "@/lib/ffmpeg";
import { writeFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  console.log(`[Audio Upload] Starting for project ${id}`);
  console.log(`[Audio Upload] Content-Type: ${req.headers.get("content-type")}`);
  console.log(`[Audio Upload] Content-Length: ${req.headers.get("content-length")}`);

  try {
    const projectDir = await ensureProjectDir(id);

    // Read body as ArrayBuffer directly (avoids formData parsing issues)
    const contentType = req.headers.get("content-type") || "";
    const boundaryMatch = contentType.match(/boundary=(.+)/);

    if (!boundaryMatch) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
    }

    const boundary = boundaryMatch[1].trim();
    const rawBody = Buffer.from(await req.arrayBuffer());

    console.log(`[Audio Upload] Body received: ${(rawBody.length / 1024 / 1024).toFixed(1)}MB`);

    // Find file in multipart data
    const boundaryBuf = Buffer.from(`--${boundary}`);
    const headerSep = Buffer.from("\r\n\r\n");

    // Find the part containing "audio"
    let pos = 0;
    let fileData: Buffer | null = null;
    let fileName = "audio.mp3";

    while (pos < rawBody.length) {
      const bStart = rawBody.indexOf(boundaryBuf, pos);
      if (bStart === -1) break;

      const nextBStart = rawBody.indexOf(boundaryBuf, bStart + boundaryBuf.length);
      if (nextBStart === -1) break;

      // Extract this part
      const partStart = bStart + boundaryBuf.length + 2; // skip boundary + \r\n
      const partEnd = nextBStart - 2; // before \r\n before next boundary

      const headerEndPos = rawBody.indexOf(headerSep, partStart);
      if (headerEndPos === -1 || headerEndPos > partEnd) {
        pos = nextBStart;
        continue;
      }

      const headerStr = rawBody.slice(partStart, headerEndPos).toString("utf-8");

      if (headerStr.includes('name="audio"')) {
        const fnMatch = headerStr.match(/filename="([^"]+)"/);
        if (fnMatch) fileName = fnMatch[1];

        const dataStart = headerEndPos + headerSep.length;
        fileData = rawBody.slice(dataStart, partEnd);
        break;
      }

      pos = nextBStart;
    }

    if (!fileData || fileData.length === 0) {
      console.error("[Audio Upload] No audio data found in multipart body");
      return NextResponse.json({ error: "No audio file found" }, { status: 400 });
    }

    const ext = path.extname(fileName) || ".mp3";
    const audioPath = path.join(projectDir, `audio${ext}`);

    await writeFile(audioPath, fileData);
    console.log(`[Audio Upload] Saved: ${audioPath} (${(fileData.length / 1024 / 1024).toFixed(1)}MB)`);

    let duration = 0;
    try {
      duration = await getAudioDuration(audioPath);
    } catch (e) {
      console.warn("[Audio Upload] Could not get duration:", e);
    }

    await prisma.project.update({
      where: { id },
      data: { audioPath, audioDuration: duration },
    });

    console.log(`[Audio Upload] Complete! Duration: ${duration}s`);
    return NextResponse.json({ audioPath, duration });
  } catch (error) {
    console.error("[Audio Upload] Error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
