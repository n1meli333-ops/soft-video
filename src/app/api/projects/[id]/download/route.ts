import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createReadStream, statSync } from "fs";
import { Readable } from "stream";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });

  if (!project?.outputPath) {
    return NextResponse.json({ error: "No video available" }, { status: 404 });
  }

  try {
    const stat = statSync(project.outputPath);
    const stream = createReadStream(project.outputPath);
    const fileName = `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}.mp4`;

    // Convert Node stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new Response(webStream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
