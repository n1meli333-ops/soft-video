import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const templates = await prisma.promptTemplate.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const template = await prisma.promptTemplate.create({
    data: {
      name: body.name || "New Template",
      stylePrompt: body.stylePrompt || "",
      negativePrompt: body.negativePrompt || "",
      techPrompt: body.techPrompt || "",
      indexFormat: body.indexFormat || "",
      isDefault: body.isDefault || false,
    },
  });
  return NextResponse.json(template);
}
