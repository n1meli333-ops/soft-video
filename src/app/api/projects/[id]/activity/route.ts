import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const activities = await prisma.activity.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return NextResponse.json(activities);
}
