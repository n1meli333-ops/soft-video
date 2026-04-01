import { prisma } from "./db";

export async function logActivity(
  projectId: string,
  type: "info" | "success" | "error" | "warning" | "progress",
  message: string,
  options?: {
    stage?: string;
    details?: string;
    progress?: number;
  }
) {
  await prisma.activity.create({
    data: {
      projectId,
      type,
      stage: options?.stage || null,
      message,
      details: options?.details || null,
      progress: options?.progress || null,
    },
  });
}

export async function updateProjectProgress(
  projectId: string,
  stage: string,
  progress: number,
  message: string
) {
  await prisma.project.update({
    where: { id: projectId },
    data: {
      currentStage: stage,
      progress,
      statusMessage: message,
    },
  });
}
