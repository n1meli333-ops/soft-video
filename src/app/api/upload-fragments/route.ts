import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureProjectDir } from "@/lib/utils";
import { getVideoDuration } from "@/lib/ffmpeg";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const projectId = formData.get("projectId") as string;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    const projectDir = await ensureProjectDir(projectId);
    const files = formData.getAll("fragments") as File[];
    const results: Array<{ index: number; path: string; duration: number }> = [];

    for (const file of files) {
      // Extract index from filename, e.g., "fragment_001.mp4" -> 0
      const match = file.name.match(/(\d+)/);
      const index = match ? parseInt(match[1], 10) - 1 : results.length;

      const fragmentPath = path.join(projectDir, "fragments", `fragment_${String(index).padStart(4, "0")}.mp4`);

      const bytes = await file.arrayBuffer();
      await writeFile(fragmentPath, Buffer.from(bytes));

      let duration = 0;
      try {
        duration = await getVideoDuration(fragmentPath);
      } catch (e) {
        console.warn(`Could not get duration for fragment ${index}:`, e);
      }

      await prisma.fragment.updateMany({
        where: { projectId, index },
        data: {
          videoPath: fragmentPath,
          duration,
          status: "completed",
        },
      });

      results.push({ index, path: fragmentPath, duration });
    }

    return NextResponse.json({ uploaded: results.length, fragments: results });
  } catch (error) {
    console.error("Fragment upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
