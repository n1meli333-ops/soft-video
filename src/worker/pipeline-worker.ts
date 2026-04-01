/**
 * Aura-I Pipeline Worker
 *
 * Background process that executes the full video generation pipeline:
 * 1. transcribing       - Transcribe audio via AssemblyAI
 * 2. generating_prompts - Generate video prompts via Gemini web (Playwright)
 * 3. generating_images  - Generate images via Nano Banana Pro on Flow (Playwright)
 * 4. generating_videos  - Generate videos via veo3.1 fast on Flow (Playwright)
 * 5. rendering          - Render final video via ffmpeg
 *
 * Run: npm run worker
 */

import { PrismaClient } from "@prisma/client";
import { transcribeAudio } from "../lib/assemblyai";
import { ensureProjectDir } from "../lib/utils";
import { renderVideo } from "../lib/ffmpeg";
import { generatePromptsViaBrowser } from "../lib/playwright/prompt-generator";
import { generateImage } from "../lib/playwright/image-generator";
import { generateVideo } from "../lib/playwright/video-generator";
import { ensureLoggedIn, shutdown } from "../lib/playwright/browser-manager";
import { writeFile } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

const POLL_INTERVAL = 5000;
const FRAGMENT_DURATION = parseInt(process.env.FRAGMENT_DURATION || "8");

// ---- Helpers ----

async function log(projectId: string, type: string, message: string, stage?: string) {
  console.log(`  [${type}] ${message}`);
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
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { status: true } });
  return p?.status === "cancelled";
}

async function failProject(projectId: string, stage: string, error: string) {
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "failed", errorMessage: error, statusMessage: `Failed at ${stage}` },
  });
  await log(projectId, "error", error, stage);
}

// ============================================================
// Stage 1: Transcription (AssemblyAI API)
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
    await failProject(projectId, "transcribing", error instanceof Error ? error.message : "Transcription failed");
    return false;
  }
}

// ============================================================
// Stage 2: Generate Prompts (Gemini Web via Playwright)
// ============================================================
async function stageGeneratePrompts(projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { template: true },
  });
  if (!project?.transcriptTxt || !project.audioDuration) return false;

  const totalFragments = Math.ceil(project.audioDuration / FRAGMENT_DURATION);
  await updateProgress(projectId, "generating_prompts", 5, `Generating ${totalFragments} prompts via Gemini...`);
  await log(projectId, "info", `Need ${totalFragments} prompts (${FRAGMENT_DURATION}s per fragment)`, "generating_prompts");

  // Build special prompt from template
  let specialPrompt = "";
  if (project.template) {
    const t = project.template;
    specialPrompt = [t.stylePrompt, t.negativePrompt, t.techPrompt, t.indexFormat]
      .filter(Boolean)
      .join("\n\n");
  }

  try {
    const prompts = await generatePromptsViaBrowser({
      totalFragments,
      specialPrompt,
      transcriptText: project.transcriptTxt,
      timestampsJson: project.transcriptJson || "[]",
      onProgress: async (generated, total) => {
        const pct = Math.round((generated / total) * 90) + 5;
        await updateProgress(projectId, "generating_prompts", pct, `Generated ${generated}/${total} prompts`);
      },
    });

    // Create fragments
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
    await failProject(projectId, "generating_prompts", error instanceof Error ? error.message : "Prompt generation failed");
    return false;
  }
}

// ============================================================
// Stage 3: Generate Images (Nano Banana Pro via Flow)
// ============================================================
async function stageGenerateImages(projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return false;

  // Skip for text-to-video flow
  if (project.flowMode === "text-to-video") {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "generating_videos",
        currentStage: "generating_videos",
        progress: 0,
        statusMessage: "Skipping images (text-to-video mode)...",
      },
    });
    await log(projectId, "info", "Skipping image generation (text-to-video mode)", "generating_images");
    return true;
  }

  const fragments = await prisma.fragment.findMany({
    where: { projectId, status: "pending" },
    orderBy: { index: "asc" },
  });

  await log(projectId, "info", `Generating ${fragments.length} images via Nano Banana Pro`, "generating_images");
  const projectDir = await ensureProjectDir(projectId);

  for (let i = 0; i < fragments.length; i++) {
    if (await isStopRequested(projectId)) {
      await log(projectId, "warning", "Stopped by user", "generating_images");
      return false;
    }

    const fragment = fragments[i];
    const pct = Math.round((i / fragments.length) * 100);
    await updateProgress(projectId, "generating_images", pct, `Image ${i + 1}/${fragments.length}`);

    await prisma.fragment.update({
      where: { id: fragment.id },
      data: { status: "generating_image" },
    });

    const imagePath = path.join(projectDir, "images", `fragment_${String(fragment.index).padStart(4, "0")}.png`);
    const result = await generateImage(fragment.prompt, imagePath);

    if (result.success) {
      await prisma.fragment.update({
        where: { id: fragment.id },
        data: { imagePath, status: "generating_video" },
      });
      await log(projectId, "progress", `Image #${fragment.index + 1} ✓`, "generating_images");
    } else {
      await prisma.fragment.update({
        where: { id: fragment.id },
        data: { status: "failed", errorMessage: result.error || "Image generation failed" },
      });
      await log(projectId, "warning", `Image #${fragment.index + 1} failed: ${result.error}`, "generating_images");
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
  await log(projectId, "success", "Image generation complete", "generating_images");
  return true;
}

// ============================================================
// Stage 4: Generate Videos (veo3.1 fast via Flow)
// ============================================================
async function stageGenerateVideos(projectId: string): Promise<boolean> {
  const fragments = await prisma.fragment.findMany({
    where: { projectId, status: { in: ["generating_video", "pending"] } },
    orderBy: { index: "asc" },
  });

  await log(projectId, "info", `Generating ${fragments.length} videos via veo3.1 fast`, "generating_videos");
  const projectDir = await ensureProjectDir(projectId);

  for (let i = 0; i < fragments.length; i++) {
    if (await isStopRequested(projectId)) {
      await log(projectId, "warning", "Stopped by user", "generating_videos");
      return false;
    }

    const fragment = fragments[i];
    const pct = Math.round((i / fragments.length) * 100);
    await updateProgress(projectId, "generating_videos", pct, `Video ${i + 1}/${fragments.length}`);

    await prisma.fragment.update({
      where: { id: fragment.id },
      data: { status: "generating_video" },
    });

    const videoPath = path.join(projectDir, "videos", `fragment_${String(fragment.index).padStart(4, "0")}.mp4`);
    const result = await generateVideo(
      fragment.prompt,
      videoPath,
      fragment.imagePath || undefined // Pass image for image-to-video flow
    );

    if (result.success) {
      await prisma.fragment.update({
        where: { id: fragment.id },
        data: {
          videoPath,
          status: "completed",
          duration: FRAGMENT_DURATION,
        },
      });
      await log(projectId, "progress", `Video #${fragment.index + 1} ✓`, "generating_videos");
    } else {
      await prisma.fragment.update({
        where: { id: fragment.id },
        data: { status: "failed", errorMessage: result.error || "Video generation failed" },
      });
      await log(projectId, "warning", `Video #${fragment.index + 1} failed: ${result.error}`, "generating_videos");
    }
  }

  // Check if any succeeded
  const completedCount = await prisma.fragment.count({
    where: { projectId, status: "completed" },
  });

  if (completedCount === 0) {
    await failProject(projectId, "generating_videos", "All video generations failed");
    return false;
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: "rendering",
      currentStage: "rendering",
      progress: 0,
      statusMessage: `${completedCount} videos done. Rendering...`,
    },
  });
  await log(projectId, "success", `${completedCount} videos generated`, "generating_videos");
  return true;
}

// ============================================================
// Stage 5: Render Final Video (ffmpeg)
// ============================================================
async function stageRender(projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return false;

  const fragments = await prisma.fragment.findMany({
    where: { projectId, status: "completed", videoPath: { not: null } },
    orderBy: { index: "asc" },
  });

  if (fragments.length === 0) {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "completed",
        currentStage: null,
        progress: 100,
        statusMessage: "Pipeline complete (no video files to render)",
      },
    });
    await log(projectId, "success", "Pipeline complete (no video files)", "rendering");
    return true;
  }

  await updateProgress(projectId, "rendering", 10, "Rendering final video...");
  await log(projectId, "info", `Rendering ${fragments.length} fragments`, "rendering");

  try {
    const projectDir = await ensureProjectDir(projectId);
    const videoPaths = fragments.map((f) => f.videoPath!);
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

    await log(projectId, "success", "Final video rendered!", "rendering");
    return true;
  } catch (error) {
    await failProject(projectId, "rendering", error instanceof Error ? error.message : "Render failed");
    return false;
  }
}

// ============================================================
// Regeneration handler (for individual failed fragments)
// ============================================================
async function handleRegenerations(projectId: string): Promise<void> {
  const pendingFragments = await prisma.fragment.findMany({
    where: {
      projectId,
      status: "pending",
      retryCount: { gt: 0 },
    },
    orderBy: { index: "asc" },
  });

  if (pendingFragments.length === 0) return;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !["completed", "failed", "ready"].includes(project.status)) return;

  console.log(`  Regenerating ${pendingFragments.length} fragments...`);
  const projectDir = await ensureProjectDir(projectId);

  for (const fragment of pendingFragments) {
    // Generate image (if image-to-video)
    if (project.flowMode === "image-to-video") {
      await prisma.fragment.update({ where: { id: fragment.id }, data: { status: "generating_image" } });
      const imagePath = path.join(projectDir, "images", `fragment_${String(fragment.index).padStart(4, "0")}.png`);
      const imgResult = await generateImage(fragment.prompt, imagePath);
      if (!imgResult.success) {
        await prisma.fragment.update({
          where: { id: fragment.id },
          data: { status: "failed", errorMessage: imgResult.error },
        });
        await log(projectId, "warning", `Regen image #${fragment.index + 1} failed`, "generating_images");
        continue;
      }
      await prisma.fragment.update({ where: { id: fragment.id }, data: { imagePath } });
    }

    // Generate video
    await prisma.fragment.update({ where: { id: fragment.id }, data: { status: "generating_video" } });
    const videoPath = path.join(projectDir, "videos", `fragment_${String(fragment.index).padStart(4, "0")}.mp4`);
    const vidResult = await generateVideo(fragment.prompt, videoPath, fragment.imagePath || undefined);

    if (vidResult.success) {
      await prisma.fragment.update({
        where: { id: fragment.id },
        data: { videoPath, status: "completed", duration: FRAGMENT_DURATION, errorMessage: null },
      });
      await log(projectId, "success", `Fragment #${fragment.index + 1} regenerated ✓`, "generating_videos");
    } else {
      await prisma.fragment.update({
        where: { id: fragment.id },
        data: { status: "failed", errorMessage: vidResult.error },
      });
      await log(projectId, "warning", `Regen video #${fragment.index + 1} failed: ${vidResult.error}`, "generating_videos");
    }
  }
}

// ============================================================
// Main Worker Loop
// ============================================================
async function pollForWork() {
  const activeStatuses = ["transcribing", "generating_prompts", "generating_images", "generating_videos", "rendering"];

  // Check for active pipeline projects
  const projects = await prisma.project.findMany({
    where: { status: { in: activeStatuses } },
    orderBy: { updatedAt: "asc" },
    take: 1,
  });

  if (projects.length > 0) {
    const p = projects[0];
    console.log(`\n→ [${p.name}] Stage: ${p.status}`);

    switch (p.status) {
      case "transcribing":
        await stageTranscribe(p.id);
        break;
      case "generating_prompts":
        await stageGeneratePrompts(p.id);
        break;
      case "generating_images":
        await stageGenerateImages(p.id);
        break;
      case "generating_videos":
        await stageGenerateVideos(p.id);
        break;
      case "rendering":
        await stageRender(p.id);
        break;
    }
    return;
  }

  // Check for fragment regeneration requests
  const projectsWithRegens = await prisma.project.findMany({
    where: {
      status: { in: ["completed", "failed", "ready"] },
      fragments: { some: { status: "pending", retryCount: { gt: 0 } } },
    },
    take: 1,
  });

  if (projectsWithRegens.length > 0) {
    await handleRegenerations(projectsWithRegens[0].id);
  }
}

async function main() {
  console.log("🚀 Aura-I Pipeline Worker v0.3.0");
  console.log(`   Fragment duration: ${FRAGMENT_DURATION}s`);
  console.log(`   Poll interval: ${POLL_INTERVAL}ms`);
  console.log("");

  // Ensure browser login on startup
  console.log("Checking Google login...");
  try {
    await ensureLoggedIn();
    console.log("✓ Logged in to Google\n");
  } catch (e) {
    console.log("⚠ Could not verify login — will retry when needed\n");
  }

  // Main loop
  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await shutdown();
    process.exit(0);
  });

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
