/**
 * Image Generation via Google Flow (Nano Banana Pro)
 *
 * Automates labs.google/fx/tools/flow to generate images
 * using the Nano Banana Pro model.
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

  // If on home page, create or select a project
  const newProjectBtn = await page.$(FLOW_HOME.newProjectButton);
  if (newProjectBtn) {
    await newProjectBtn.click();
    await page.waitForTimeout(3000);
    console.log("[ImageGen] Created new Flow project");
  }
}

/**
 * Switch Flow to Image mode and select Nano Banana Pro model.
 */
async function switchToImageMode(page: Page): Promise<void> {
  // Click on mode button to open mode selector
  try {
    const modeBtn = await page.$(FLOW_EDITOR.modeButton);
    if (modeBtn) {
      const modeText = await modeBtn.textContent();
      if (modeText && !modeText.toLowerCase().includes("image")) {
        await modeBtn.click();
        await page.waitForTimeout(1000);

        // Select Image mode
        const imageOption = await page.$(FLOW_EDITOR.imageModeOption);
        if (imageOption) {
          await imageOption.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  } catch (e) {
    console.log("[ImageGen] Could not switch mode:", e);
  }

  // Try to select Nano Banana Pro model
  try {
    const settingsBtn = await page.$(FLOW_EDITOR.settingsButton);
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForTimeout(1000);

      // Look for model selector options
      const nanoBanana = await page.$(FLOW_EDITOR.nanoBananaProOption)
        || await page.$(FLOW_EDITOR.nanoBanana2Option)
        || await page.$(FLOW_EDITOR.nanoBananaOption);
      if (nanoBanana) {
        await nanoBanana.click();
        await page.waitForTimeout(500);
      }

      // Close settings
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  } catch (e) {
    console.log("[ImageGen] Could not select model:", e);
  }
}

/**
 * Generate a single image in Flow.
 * Returns the path to the downloaded image.
 */
export async function generateImage(
  prompt: string,
  outputPath: string
): Promise<{ success: boolean; error?: string }> {
  await ensureLoggedIn();

  const ctx = await getContext();
  const page = await ctx.newPage();

  try {
    console.log(`[ImageGen] Generating image: "${prompt.slice(0, 50)}..."`);

    await ensureFlowProject(page);
    await switchToImageMode(page);

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

    console.log("[ImageGen] Prompt sent, waiting for generation...");

    // Wait for generation to complete
    // First wait for loading indicator
    try {
      await page.waitForSelector(FLOW_EDITOR.generatingIndicator, { timeout: 10000 });
    } catch {}

    // Wait for loading to finish
    await page.waitForFunction(
      (sel: string) => !document.querySelector(sel),
      FLOW_EDITOR.generatingIndicator,
      { timeout: TIMEOUTS.imageGeneration }
    );

    await page.waitForTimeout(2000);

    // Check for errors
    const error = await page.$(FLOW_EDITOR.errorMessage);
    if (error) {
      const errorText = await error.textContent();
      console.log(`[ImageGen] Generation blocked: ${errorText}`);
      await page.close();
      return { success: false, error: errorText || "Content policy block" };
    }

    // Find and download the generated image
    const image = await page.$(FLOW_EDITOR.generatedImage);
    if (!image) {
      await page.close();
      return { success: false, error: "No image found after generation" };
    }

    // Get image src and download it
    const imgSrc = await image.getAttribute("src");
    if (imgSrc) {
      // Ensure output directory exists
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });

      // Download image
      const response = await page.context().request.get(imgSrc);
      const buffer = await response.body();
      fs.writeFileSync(outputPath, buffer);

      console.log(`[ImageGen] Image saved to: ${outputPath}`);
      await saveSession();
      await page.close();
      return { success: true };
    }

    // Alternative: try right-click download or screenshot
    await image.screenshot({ path: outputPath });
    console.log(`[ImageGen] Image screenshot saved to: ${outputPath}`);
    await saveSession();
    await page.close();
    return { success: true };

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Image generation failed";
    console.error("[ImageGen] Error:", msg);
    await page.close();
    return { success: false, error: msg };
  }
}
