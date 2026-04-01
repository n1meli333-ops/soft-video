import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.project.update({
    where: { id },
    data: {
      status: "cancelled",
      statusMessage: "Cancelled by user",
    },
  });

  await prisma.activity.create({
    data: {
      projectId: id,
      type: "warning",
      stage: project.currentStage,
      message: "Pipeline stopped by user",
    },
  });

  return NextResponse.json({ success: true });
}
