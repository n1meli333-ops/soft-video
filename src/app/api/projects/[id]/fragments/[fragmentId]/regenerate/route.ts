import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fragmentId: string }> }
) {
  const { id, fragmentId } = await params;

  const fragment = await prisma.fragment.findUnique({
    where: { id: fragmentId },
  });

  if (!fragment || fragment.projectId !== id) {
    return NextResponse.json({ error: "Fragment not found" }, { status: 404 });
  }

  // Reset fragment status — the worker will pick it up and regenerate
  await prisma.fragment.update({
    where: { id: fragmentId },
    data: {
      status: "pending",
      videoPath: null,
      imagePath: null,
      thumbnailPath: null,
      errorMessage: null,
      retryCount: { increment: 1 },
    },
  });

  await prisma.activity.create({
    data: {
      projectId: id,
      type: "info",
      stage: "generating_videos",
      message: `Fragment #${fragment.index + 1} queued for regeneration`,
    },
  });

  return NextResponse.json({ status: "pending" });
}
