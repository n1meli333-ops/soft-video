/**
 * Prompt Generation via Gemini Web (gemini.google.com)
 *
 * Automates chat with Gemini to generate video prompts in batches of 100,
 * automatically sending "continue" until all fragments are covered.
 */

import { getContext, ensureLoggedIn, saveSession, handleConsentPopup } from "./browser-manager";
import { GEMINI_URL, GEMINI_CHAT, TIMEOUTS } from "./selectors";
import { Page } from "playwright";
import path from "path";
import fs from "fs";

interface PromptGenerationOptions {
  totalFragments: number;
  specialPrompt: string; // Combined prompt with template fields injected
  transcriptText: string;
  timestampsJson: string;
  onProgress?: (generated: number, total: number) => Promise<void>;
}

/**
 * Extract prompts from Gemini's response text.
 * Handles numbered lists like "1. prompt text" or JSON arrays.
 */
function parsePromptsFromResponse(text: string): string[] {
  // Try JSON array first
  const jsonMatch = text.match(/\[[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(String);
      }
    } catch {}
  }

  // Try numbered list: "1. prompt text" or "1) prompt text"
  const lines = text.split("\n");
  const prompts: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*\d+[\.\)]\s*(.+)/);
    if (match && match[1].trim().length > 10) {
      prompts.push(match[1].trim());
    }
  }

  return prompts;
}

/**
 * Wait for Gemini to finish generating its response.
 */
async function waitForResponse(page: Page): Promise<string> {
  // Wait for thinking indicator to appear then disappear
  try {
    await page.waitForSelector(GEMINI_CHAT.thinkingIndicator, { timeout: 10000 });
  } catch {
    // May have already started responding
  }

  // Wait for thinking to finish (response complete)
  await page.waitForFunction(
    (sel: string) => !document.querySelector(sel),
    GEMINI_CHAT.thinkingIndicator,
    { timeout: TIMEOUTS.promptGeneration }
  );

  // Extra wait for content to settle
  await page.waitForTimeout(2000);

  // Get the last response text
  const responseText = await page.evaluate((sel: string) => {
    const responses = document.querySelectorAll(sel);
    if (responses.length === 0) return "";
    const last = responses[responses.length - 1];
    return last?.textContent || "";
  }, GEMINI_CHAT.responseText);

  return responseText;
}

/**
 * Type text into Gemini chat and send.
 */
async function sendMessage(page: Page, message: string): Promise<void> {
  // Click on chat input to focus
  const input = await page.waitForSelector(GEMINI_CHAT.chatInput, { timeout: TIMEOUTS.navigation });
  if (!input) throw new Error("Chat input not found");

  await input.click();
  await page.waitForTimeout(500);

  // Type the message (use keyboard for contenteditable)
  await page.keyboard.insertText(message);
  await page.waitForTimeout(500);

  // Click send button
  const sendBtn = await page.waitForSelector(GEMINI_CHAT.sendButton, { timeout: 5000 });
  if (sendBtn) {
    await sendBtn.click();
  } else {
    // Fallback: press Enter
    await page.keyboard.press("Enter");
  }
}

/**
 * Open a new Gemini chat session.
 */
async function openNewChat(page: Page): Promise<void> {
  console.log(`[PromptGen] Navigating to ${GEMINI_URL}`);
  await page.goto(GEMINI_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(5000);

  // Handle consent popup if shown
  await handleConsentPopup(page);
  await page.waitForTimeout(2000);

  // Log current URL to see if we got redirected (login, consent, etc.)
  console.log(`[PromptGen] Current URL: ${page.url()}`);

  // Take debug screenshot
  const debugDir = path.join(process.cwd(), "data");
  fs.mkdirSync(debugDir, { recursive: true });
  await page.screenshot({ path: path.join(debugDir, "gemini-debug.png"), fullPage: true });
  console.log(`[PromptGen] Debug screenshot saved to data/gemini-debug.png`);

  // Try clicking "New chat" if available
  try {
    const newChatBtn = await page.$(GEMINI_CHAT.newChatButton);
    if (newChatBtn) {
      await newChatBtn.click();
      await page.waitForTimeout(2000);
    }
  } catch {}
}

/**
 * Generate video prompts via Gemini Web browser automation.
 *
 * Flow:
 * 1. Open new Gemini chat
 * 2. Send special prompt + transcript
 * 3. Parse first batch of prompts (up to 100)
 * 4. If more needed, send "continue" and parse next batch
 * 5. Repeat until totalFragments is reached
 */
export async function generatePromptsViaBrowser(
  options: PromptGenerationOptions
): Promise<string[]> {
  const { totalFragments, specialPrompt, transcriptText, timestampsJson, onProgress } = options;

  await ensureLoggedIn();

  const ctx = await getContext();
  const page = await ctx.newPage();

  try {
    console.log(`[PromptGen] Generating ${totalFragments} prompts via Gemini web`);

    await openNewChat(page);

    // Build the initial prompt
    const initialPrompt = `${specialPrompt}

Transcription:
${transcriptText}

Timestamps:
${timestampsJson}

I need exactly ${totalFragments} video prompts. Generate the first 100 prompts now as a numbered list (1. prompt, 2. prompt, etc).`;

    // Send initial prompt
    console.log("[PromptGen] Sending initial prompt...");
    await sendMessage(page, initialPrompt);

    const allPrompts: string[] = [];

    // Parse first batch
    const firstResponse = await waitForResponse(page);
    const firstBatch = parsePromptsFromResponse(firstResponse);
    allPrompts.push(...firstBatch);
    console.log(`[PromptGen] First batch: ${firstBatch.length} prompts`);

    if (onProgress) await onProgress(allPrompts.length, totalFragments);

    // Continue generating until we have enough
    let maxRetries = 20; // Safety limit
    while (allPrompts.length < totalFragments && maxRetries > 0) {
      const remaining = totalFragments - allPrompts.length;
      const continueMsg = remaining > 100
        ? `Continue. Generate the next 100 prompts starting from #${allPrompts.length + 1}.`
        : `Continue. Generate the remaining ${remaining} prompts starting from #${allPrompts.length + 1}. This is the last batch.`;

      console.log(`[PromptGen] Sending continue... (have ${allPrompts.length}/${totalFragments})`);
      await sendMessage(page, continueMsg);

      const response = await waitForResponse(page);
      const batch = parsePromptsFromResponse(response);

      if (batch.length === 0) {
        console.log("[PromptGen] No prompts in response, retrying...");
        maxRetries--;
        continue;
      }

      allPrompts.push(...batch);
      console.log(`[PromptGen] Batch: +${batch.length}, total: ${allPrompts.length}/${totalFragments}`);

      if (onProgress) await onProgress(allPrompts.length, totalFragments);
      maxRetries--;
    }

    // Trim to exact count
    const result = allPrompts.slice(0, totalFragments);
    console.log(`[PromptGen] Done! Generated ${result.length} prompts`);

    await saveSession();
    await page.close();

    return result;
  } catch (error) {
    console.error("[PromptGen] Error:", error);
    // Save error screenshot
    try {
      const debugDir = path.join(process.cwd(), "data");
      fs.mkdirSync(debugDir, { recursive: true });
      await page.screenshot({ path: path.join(debugDir, "gemini-error.png"), fullPage: true });
      console.log(`[PromptGen] Error screenshot saved to data/gemini-error.png`);
      console.log(`[PromptGen] Page URL at error: ${page.url()}`);
    } catch {}
    await page.close();
    throw error;
  }
}
