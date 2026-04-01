/**
 * Video Generation via Google Flow (veo3.1 fast)
 *
 * Automates labs.google/fx/tools/flow to generate videos.
 * Supports both:
 * - Image-to-video: uploads source image + prompt
 * - Text-to-video: prompt only
 */

import { getContext, ensureLoggedIn, saveSession } from "./browser-manager";
import { FLOW_URL, FLOW_EDITOR, FLOW_HOME, TIMEOUTS } from "./selectors";
import { Page } from "playwright";
import fs from "fs";
import path from "path";

/**
 * Navigate to Flow and ensure we're in a project.
 */
async function ensureFlowProject(page: Page): Promise<void> {
  const currentUrl = page.url();

  if (!currentUrl.includes("labs.google/fx/tools/flow")) {
    await page.goto(FLOW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUTS.navigation });
    await page.waitForTimeout(3000);
  }

  const newProjectBtn = await page.$(FLOW_HOME.newProjectButton);
  if (newProjectBtn) {
    await newProjectBtn.click();
    await page.waitForTimeout(3000);
  }
}

/**
 * Switch Flow to Video mode with veo3.1 fast.
 */
async function switchToVideoMode(page: Page): Promise<void> {
  try {
    const modeBtn = await page.$(FLOW_EDITOR.modeButton);
    if (modeBtn) {
      const modeText = await modeBtn.textContent();
      if (modeText && !modeText.toLowerCase().includes("video")) {
        await modeBtn.click();
        await page.waitForTimeout(1000);

        const videoOption = await page.$(FLOW_EDITOR.videoModeOption);
        if (videoOption) {
          await videoOption.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  } catch (e) {
    console.log("[VideoGen] Mode already set or error:", e);
  }

  // Try to select veo3.1 fast model
  try {
    const settingsBtn = await page.$(FLOW_EDITOR.settingsButton);
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForTimeout(1000);

      const veoOption = await page.$(FLOW_EDITOR.veo31FastOption)
        || await page.$(FLOW_EDITOR.veo31Option);
      if (veoOption) {
        await veoOption.click();
        await page.waitForTimeout(500);
      }

      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  } catch (e) {
    console.log("[VideoGen] Could not select model:", e);
  }
}

/**
 * Upload a source image for image-to-video generation.
 */
async function uploadSourceImage(page: Page, imagePath: string): Promise<void> {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Source image not found: ${imagePath}`);
  }

  // Try the "+" add media button
  const addBtn = await page.$(FLOW_EDITOR.addMediaButton);
  if (addBtn) {
    await addBtn.click();
    await page.waitForTimeout(1000);
  }

  // Find file input and upload
  const fileInput = await page.$(FLOW_EDITOR.uploadInput);
  if (fileInput) {
    await fileInput.setInputFiles(imagePath);
    console.log(`[VideoGen] Source image uploaded: ${imagePath}`);
    await page.waitForTimeout(2000);
  } else {
    // Try drag-and-drop fallback
    console.log("[VideoGen] No file input found, trying alternative upload...");
    // Could also try clipboard paste
  }
}

/**
 * Wait for video download link and save the video.
 */
async function downloadVideo(page: Page, outputPath: string): Promise<boolean> {
  // Set up download handler
  const downloadPromise = page.waitForEvent("download", { timeout: TIMEOUTS.downloadWait }).catch(() => null);

  // Try to click download button
  const dlBtn = await page.$(FLOW_EDITOR.downloadButton);
  if (dlBtn) {
    await dlBtn.click();
  } else {
    // Try more options -> download
    const moreBtn = await page.$(FLOW_EDITOR.moreOptionsButton);
    if (moreBtn) {
      await moreBtn.click();
      await page.waitForTimeout(500);
      const dlOption = await page.$('text="Download"');
      if (dlOption) await dlOption.click();
    }
  }

  const download = await downloadPromise;
  if (download) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await download.saveAs(outputPath);
    console.log(`[VideoGen] Video saved to: ${outputPath}`);
    return true;
  }

  // Fallback: try to get video src directly
  const video = await page.$(FLOW_EDITOR.generatedVideo);
  if (video) {
    const src = await video.getAttribute("src");
    if (src) {
      const response = await page.context().request.get(src);
      const buffer = await response.body();
      fs.writeFileSync(outputPath, buffer);
      console.log(`[VideoGen] Video downloaded from src: ${outputPath}`);
      return true;
    }
  }

  return false;
}

/**
 * Generate a single video in Flow.
 *
 * @param prompt - Video generation prompt
 * @param outputPath - Where to save the generated video
 * @param imagePath - Source image for image-to-video (optional)
 */
export async function generateVideo(
  prompt: string,
  outputPath: string,
  imagePath?: string
): Promise<{ success: boolean; error?: string }> {
  await ensureLoggedIn();

  const ctx = await getContext();
  const page = await ctx.newPage();

  try {
    console.log(`[VideoGen] Generating video: "${prompt.slice(0, 50)}..."`);

    await ensureFlowProject(page);
    await switchToVideoMode(page);

    // Upload source image if image-to-video flow
    if (imagePath) {
      await uploadSourceImage(page, imagePath);
    }

    // Type prompt
    const input = await page.waitForSelector(FLOW_EDITOR.promptInput, { timeout: TIMEOUTS.navigation });
    if (!input) throw new Error("Prompt input not found");

    await input.click();
    await page.waitForTimeout(300);
    await page.keyboard.insertText(prompt);
    await page.waitForTimeout(500);

    // Click send
    const sendBtn = await page.$(FLOW_EDITOR.sendButton);
    if (sendBtn) {
      await sendBtn.click();
    } else {
      await page.keyboard.press("Enter");
    }

    console.log("[VideoGen] Prompt sent, waiting for video generation...");

    // Wait for generation to start
    try {
      await page.waitForSelector(FLOW_EDITOR.generatingIndicator, { timeout: 15000 });
    } catch {}

    // Wait for generation to complete (videos can take up to 10 min)
    await page.waitForFunction(
      (sel: string) => !document.querySelector(sel),
      FLOW_EDITOR.generatingIndicator,
      { timeout: TIMEOUTS.videoGeneration }
    );

    await page.waitForTimeout(3000);

    // Check for errors
    const error = await page.$(FLOW_EDITOR.errorMessage);
    if (error) {
      const errorText = await error.textContent();
      console.log(`[VideoGen] Generation blocked: ${errorText}`);
      await page.close();
      return { success: false, error: errorText || "Content policy block" };
    }

    // Download the generated video
    const downloaded = await downloadVideo(page, outputPath);
    if (!downloaded) {
      await page.close();
      return { success: false, error: "Could not download generated video" };
    }

    await saveSession();
    await page.close();
    return { success: true };

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Video generation failed";
    console.error("[VideoGen] Error:", msg);
    await page.close();
    return { success: false, error: msg };
  }
}
