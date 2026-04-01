import { chromium, Browser, BrowserContext, Page } from "playwright";
import path from "path";
import fs from "fs";
import { GOOGLE_LOGIN, FLOW_URL, GEMINI_URL, TIMEOUTS } from "./selectors";

const USER_DATA_DIR = process.env.PLAYWRIGHT_USER_DATA_DIR || path.join(process.cwd(), "data", "browser-profile");
const GOOGLE_EMAIL = process.env.GOOGLE_EMAIL || "";
const GOOGLE_PASSWORD = process.env.GOOGLE_PASSWORD || "";

let browser: Browser | null = null;
let context: BrowserContext | null = null;

/**
 * Get or launch the browser with persistent context (keeps cookies/login).
 */
export async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser;

  // Ensure user data dir exists
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });

  browser = await chromium.launch({
    headless: false, // Xvfb provides virtual display on VPS
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  console.log("[Browser] Launched Chromium");
  return browser;
}

/**
 * Get or create a persistent browser context (maintains cookies across sessions).
 */
export async function getContext(): Promise<BrowserContext> {
  if (context) return context;

  const b = await getBrowser();
  const storagePath = path.join(USER_DATA_DIR, "storage-state.json");

  // Try to restore previous session
  if (fs.existsSync(storagePath)) {
    try {
      context = await b.newContext({
        storageState: storagePath,
        viewport: { width: 1920, height: 1080 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      });
      console.log("[Browser] Restored previous session");
      return context;
    } catch {
      console.log("[Browser] Could not restore session, starting fresh");
    }
  }

  context = await b.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  return context;
}

/**
 * Save current browser state (cookies, localStorage) for session persistence.
 */
export async function saveSession(): Promise<void> {
  if (!context) return;
  const storagePath = path.join(USER_DATA_DIR, "storage-state.json");
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  await context.storageState({ path: storagePath });
  console.log("[Browser] Session saved");
}

/**
 * Get a new page or reuse the first open page.
 */
export async function getPage(): Promise<Page> {
  const ctx = await getContext();
  const pages = ctx.pages();
  if (pages.length > 0) return pages[0];
  return ctx.newPage();
}

/**
 * Check if we're logged into Google by visiting Flow and checking for login redirect.
 */
export async function isLoggedIn(): Promise<boolean> {
  const page = await getPage();
  try {
    await page.goto(FLOW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUTS.navigation });
    await page.waitForTimeout(3000);
    const url = page.url();
    // If redirected to accounts.google.com, we're not logged in
    return !url.includes("accounts.google.com");
  } catch {
    return false;
  }
}

/**
 * Login to Google account. Will need manual 2FA if enabled.
 */
export async function loginGoogle(): Promise<boolean> {
  if (!GOOGLE_EMAIL || !GOOGLE_PASSWORD) {
    console.error("[Browser] GOOGLE_EMAIL and GOOGLE_PASSWORD must be set in .env");
    return false;
  }

  const page = await getPage();
  console.log("[Browser] Starting Google login...");

  try {
    // Navigate to Google login
    await page.goto("https://accounts.google.com/signin", {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.navigation,
    });

    // Enter email
    await page.waitForSelector(GOOGLE_LOGIN.emailInput, { timeout: TIMEOUTS.login });
    await page.fill(GOOGLE_LOGIN.emailInput, GOOGLE_EMAIL);
    await page.click(GOOGLE_LOGIN.emailNext);
    console.log("[Browser] Email entered");

    // Wait for password field
    await page.waitForSelector(GOOGLE_LOGIN.passwordInput, { timeout: TIMEOUTS.login });
    await page.waitForTimeout(1000);
    await page.fill(GOOGLE_LOGIN.passwordInput, GOOGLE_PASSWORD);
    await page.click(GOOGLE_LOGIN.passwordNext);
    console.log("[Browser] Password entered");

    // Wait for login to complete (may need 2FA — user must handle manually)
    // We wait up to 2 minutes for manual 2FA
    console.log("[Browser] Waiting for login to complete (handle 2FA if needed)...");
    await page.waitForURL((url) => !url.toString().includes("accounts.google.com"), {
      timeout: 120000,
    });

    console.log("[Browser] Google login successful!");
    await saveSession();
    return true;
  } catch (error) {
    console.error("[Browser] Login failed:", error);
    return false;
  }
}

/**
 * Ensure we're logged in, logging in if needed.
 */
export async function ensureLoggedIn(): Promise<boolean> {
  if (await isLoggedIn()) {
    console.log("[Browser] Already logged in");
    return true;
  }
  return loginGoogle();
}

/**
 * Shutdown browser completely.
 */
export async function shutdown(): Promise<void> {
  if (context) {
    await saveSession();
    await context.close();
    context = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
  console.log("[Browser] Shutdown complete");
}
