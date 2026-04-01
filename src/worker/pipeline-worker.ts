/**
 * Aura-I Pipeline Worker
 *
 * Background process that polls the database for projects needing work
 * and executes the pipeline stages:
 *
 * 1. transcribing     - Transcribe audio via AssemblyAI
 * 2. generating_prompts - Generate video prompts via browser automation
 * 3. generating_images  - Generate images via Nano Banana Pro (browser)
 * 4. generating_videos  - Generate videos via veo3.1 fast (browser)
 * 5. rendering         - Render final video via ffmpeg
 *
 * Run: npx tsx src/worker/pipeline-worker.ts
 */

import { PrismaClient } from "@prisma/client";
import { transcribeAudio } from "../lib/assemblyai";
import { ensureProjectDir } from "../lib/utils";
import { renderVideo } from "../lib/ffmpeg";
import { writeFile } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

const POLL_INTERVAL = 5000; // 5 seconds
const FRAGMENT_DURATION = parseInt(process.env.FRAGMENT_DURATION || "8"); // seconds per fragment

async function log(projectId: string, type: string, message: string, stage?: string) {
  console.log(`[${type.toUpperCase()}] [${stage || "pipeline"}] ${message}`);
  await prisma.activity.create({
    data: { projectId, type, message, stage: stage || null },
  });
}

async function updateProgress(projectId: string, stage: string, progress: number, message: string) {
  await prisma.project.update({
    where: { id: projectId },
    data: { currentStage: stage, progress, statusMessage: message },
  });
}

async function isStopRequested(projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { status: true } });
  return project?.status === "cancelled";
}

// ============================================================
// Stage 1: Transcription
// ============================================================
async function stageTranscribe(projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project?.audioPath) return false;

  await updateProgress(projectId, "transcribing", 10, "Transcribing audio...");
  await log(projectId, "info", "Starting audio transcription", "transcribing");

  try {
    const result = await transcribeAudio(project.audioPath);
    const projectDir = await ensureProjectDir(projectId);

    await writeFile(path.join(projectDir, "transcript.txt"), result.text, "utf-8");
    await writeFile(path.join(projectDir, "timestamps.json"), JSON.stringify(result.timestamps, null, 2), "utf-8");

    await prisma.project.update({
      where: { id: projectId },
      data: {
        transcriptTxt: result.text,
        transcriptJson: JSON.stringify(result.timestamps),
        status: "generating_prompts",
        currentStage: "generating_prompts",
        progress: 0,
        statusMessage: "Transcription complete. Generating prompts...",
      },
    });

    await log(projectId, "success", `Transcription complete — ${result.timestamps.length} words`, "transcribing");
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Transcription failed";
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "failed", errorMessage: msg, statusMessage: "Transcription failed" },
    });
    await log(projectId, "error", `Transcription failed: ${msg}`, "transcribing");
    return false;
  }
}

// ============================================================
// Stage 2: Generate Prompts (via browser - placeholder)
// ============================================================
async function stageGeneratePrompts(projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { template: true },
  });
  if (!project?.transcriptTxt || !project.audioDuration) return false;

  const totalFragments = Math.ceil(project.audioDuration / FRAGMENT_DURATION);
  await updateProgress(projectId, "generating_prompts", 5, `Generating ${totalFragments} prompts...`);
  await log(projectId, "info", `Need ${totalFragments} prompts (${FRAGMENT_DURATION}s per fragment)`, "generating_prompts");

  try {
    // TODO: Replace with Playwright browser automation
    // For now, create placeholder prompts
    // The browser automation will:
    // 1. Open flow chat
    // 2. Send special prompt with template fields + transcript
    // 3. Parse first 100 prompts
    // 4. Send "continue" until all prompts are generated

    const prompts: string[] = [];
    for (let i = 0; i < totalFragments; i++) {
      prompts.push(`[Fragment ${i + 1}] Video prompt placeholder — awaiting browser automation setup`);

      if (i % 10 === 0) {
        const pct = Math.round((i / totalFragments) * 90) + 5;
        await updateProgress(projectId, "generating_prompts", pct, `Generated ${i + 1}/${totalFragments} prompts`);
      }

      if (await isStopRequested(projectId)) {
        await log(projectId, "warning", "Pipeline stopped during prompt generation", "generating_prompts");
        return false;
      }
    }

    // Delete old fragments and create new ones
    await prisma.fragment.deleteMany({ where: { projectId } });
    await prisma.fragment.createMany({
      data: prompts.map((prompt, index) => ({
        projectId,
        index,
        prompt,
        status: "pending",
      })),
    });

    await prisma.project.update({
      where: { id: projectId },
      data: {
        prompts: JSON.stringify(prompts),
        promptCount: prompts.length,
        status: "generating_images",
        currentStage: "generating_images",
        progress: 0,
        statusMessage: `${prompts.length} prompts generated. Starting image generation...`,
      },
    });

    await log(projectId, "success", `${prompts.length} prompts generated`, "generating_prompts");
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Prompt generation failed";
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "failed", errorMessage: msg, statusMessage: "Prompt generation failed" },
    });
    await log(projectId, "error", `Prompt generation failed: ${msg}`, "generating_prompts");
    return false;
  }
}

// ============================================================
// Stage 3: Generate Images (via browser - placeholder)
// ============================================================
async function stageGenerateImages(projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.flowMode === "text-to-video") {
    // Skip image generation for text-to-video flow
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "generating_videos",
        currentStage: "generating_videos",
        progress: 0,
        statusMessage: "Skipping image generation (text-to-video mode). Starting video generation...",
      },
    });
    return true;
  }

  const fragments = await prisma.fragment.findMany({
    where: { projectId, status: "pending" },
    orderBy: { index: "asc" },
  });

  await log(projectId, "info", `Generating images for ${fragments.length} fragments via Nano Banana Pro`, "generating_images");

  for (let i = 0; i < fragments.length; i++) {
    if (await isStopRequested(projectId)) {
      await log(projectId, "warning", "Pipeline stopped during image generation", "generating_images");
      return false;
    }

    const fragment = fragments[i];
    const pct = Math.round((i / fragments.length) * 100);
    await updateProgress(projectId, "generating_images", pct, `Generating image ${i + 1}/${fragments.length}`);

    try {
      // TODO: Replace with Playwright browser automation for Nano Banana Pro
      // For now, mark as ready for video generation
      await prisma.fragment.update({
        where: { id: fragment.id },
        data: { status: "generating_video", imagePath: null },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Image generation failed";
      await prisma.fragment.update({
        where: { id: fragment.id },
        data: { status: "failed", errorMessage: msg },
      });
      await log(projectId, "warning", `Fragment #${fragment.index + 1} image failed: ${msg}`, "generating_images");
    }
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: "generating_videos",
      currentStage: "generating_videos",
      progress: 0,
      statusMessage: "Images done. Starting video generation...",
    },
  });
  await log(projectId, "success", "All images generated", "generating_images");
  return true;
}

// ============================================================
// Stage 4: Generate Videos (via browser - placeholder)
// ============================================================
async function stageGenerateVideos(projectId: string): Promise<boolean> {
  const fragments = await prisma.fragment.findMany({
    where: { projectId, status: { in: ["generating_video", "pending"] } },
    orderBy: { index: "asc" },
  });

  await log(projectId, "info", `Generating videos for ${fragments.length} fragments via veo3.1 fast`, "generating_videos");

  for (let i = 0; i < fragments.length; i++) {
    if (await isStopRequested(projectId)) {
      await log(projectId, "warning", "Pipeline stopped during video generation", "generating_videos");
      return false;
    }

    const fragment = fragments[i];
    const pct = Math.round((i / fragments.length) * 100);
    await updateProgress(projectId, "generating_videos", pct, `Generating video ${i + 1}/${fragments.length}`);

    try {
      // TODO: Replace with Playwright browser automation for veo3.1 fast
      // For now, mark as completed placeholder
      await prisma.fragment.update({
        where: { id: fragment.id },
        data: { status: "completed", duration: FRAGMENT_DURATION },
      });

      await log(projectId, "progress", `Fragment #${fragment.index + 1} video complete`, "generating_videos");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Video generation failed";
      await prisma.fragment.update({
        where: { id: fragment.id },
        data: { status: "failed", errorMessage: msg },
      });
      await log(projectId, "warning", `Fragment #${fragment.index + 1} video failed: ${msg}`, "generating_videos");
    }
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: "rendering",
      currentStage: "rendering",
      progress: 0,
      statusMessage: "All videos generated. Starting render...",
    },
  });
  await log(projectId, "success", "All videos generated", "generating_videos");
  return true;
}

// ============================================================
// Stage 5: Render Final Video
// ============================================================
async function stageRender(projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return false;

  const fragments = await prisma.fragment.findMany({
    where: { projectId, status: "completed", videoPath: { not: null } },
    orderBy: { index: "asc" },
  });

  if (fragments.length === 0) {
    // No actual video files yet (placeholder mode)
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "completed",
        currentStage: null,
        progress: 100,
        statusMessage: "Pipeline complete (placeholder mode — no real videos yet)",
      },
    });
    await log(projectId, "success", "Pipeline complete (placeholder — awaiting Playwright setup)", "rendering");
    return true;
  }

  await updateProgress(projectId, "rendering", 10, "Rendering final video...");
  await log(projectId, "info", `Rendering ${fragments.length} fragments into final video`, "rendering");

  try {
    const videoPaths = fragments.map((f) => f.videoPath!);
    const projectDir = await ensureProjectDir(projectId);
    const outputPath = path.join(projectDir, "final.mp4");

    await renderVideo(projectDir, project.audioPath || "", videoPaths, outputPath);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "completed",
        currentStage: null,
        progress: 100,
        statusMessage: "Video rendered successfully!",
        outputPath,
      },
    });

    await log(projectId, "success", "Final video rendered successfully!", "rendering");
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Render failed";
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "failed", errorMessage: msg, statusMessage: "Render failed" },
    });
    await log(projectId, "error", `Render failed: ${msg}`, "rendering");
    return false;
  }
}

// ============================================================
// Main Worker Loop
// ============================================================
async function processProject(projectId: string, status: string) {
  console.log(`\n→ Processing project ${projectId} [${status}]`);

  switch (status) {
    case "transcribing":
      await stageTranscribe(projectId);
      break;
    case "generating_prompts":
      await stageGeneratePrompts(projectId);
      break;
    case "generating_images":
      await stageGenerateImages(projectId);
      break;
    case "generating_videos":
      await stageGenerateVideos(projectId);
      break;
    case "rendering":
      await stageRender(projectId);
      break;
  }
}

async function pollForWork() {
  const activeStatuses = ["transcribing", "generating_prompts", "generating_images", "generating_videos", "rendering"];

  const projects = await prisma.project.findMany({
    where: { status: { in: activeStatuses } },
    orderBy: { updatedAt: "asc" },
    take: 1, // Process one at a time
  });

  if (projects.length > 0) {
    await processProject(projects[0].id, projects[0].status);
  }
}

async function main() {
  console.log("🚀 Aura-I Pipeline Worker started");
  console.log(`   Fragment duration: ${FRAGMENT_DURATION}s`);
  console.log(`   Poll interval: ${POLL_INTERVAL}ms`);
  console.log("");

  while (true) {
    try {
      await pollForWork();
    } catch (error) {
      console.error("Worker error:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

main().catch(console.error);
