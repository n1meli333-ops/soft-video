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

  fs.mkdirSync(USER_DATA_DIR, { recursive: true });

  browser = await chromium.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
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
 * Handle Google consent popup ("Before you continue to Google").
 * Clicks "Accept all" if the consent page is shown.
 */
export async function handleConsentPopup(page: Page): Promise<void> {
  try {
    // Check for consent page
    const acceptBtn = await page.$('button:has-text("Accept all"), button:has-text("Принять все"), button:has-text("Прийняти все")');
    if (acceptBtn) {
      console.log("[Browser] Found consent popup, clicking Accept all...");
      await acceptBtn.click();
      await page.waitForTimeout(2000);
      console.log("[Browser] Consent accepted");
    }
  } catch {
    // No consent popup, continue
  }
}

/**
 * Check if we're logged into Google.
 */
export async function isLoggedIn(): Promise<boolean> {
  const page = await getPage();
  try {
    await page.goto(GEMINI_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Handle consent popup first
    await handleConsentPopup(page);
    await page.waitForTimeout(2000);

    const url = page.url();
    const content = await page.content();

    // Check for sign-in indicators
    const hasSignIn = content.includes("Sign in") || content.includes("Увійти");
    const isOnLogin = url.includes("accounts.google.com");

    if (isOnLogin || hasSignIn) {
      console.log("[Browser] Not logged in (URL:", url, ")");
      return false;
    }

    console.log("[Browser] Logged in (URL:", url, ")");
    return true;
  } catch (e) {
    console.log("[Browser] Login check failed:", e);
    return false;
  }
}

/**
 * Login to Google account.
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
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // Handle consent popup if shown
    await handleConsentPopup(page);

    // Check if already on email input or need to click Sign in
    const signInBtn = await page.$('a:has-text("Sign in"), button:has-text("Sign in")');
    if (signInBtn) {
      await signInBtn.click();
      await page.waitForTimeout(2000);
    }

    // Enter email
    await page.waitForSelector(GOOGLE_LOGIN.emailInput, { timeout: TIMEOUTS.login });
    await page.fill(GOOGLE_LOGIN.emailInput, GOOGLE_EMAIL);
    await page.waitForTimeout(500);
    await page.click(GOOGLE_LOGIN.emailNext);
    console.log("[Browser] Email entered");

    // Wait for password field
    await page.waitForTimeout(2000);
    await page.waitForSelector(GOOGLE_LOGIN.passwordInput, { timeout: TIMEOUTS.login });
    await page.waitForTimeout(1000);
    await page.fill(GOOGLE_LOGIN.passwordInput, GOOGLE_PASSWORD);
    await page.waitForTimeout(500);
    await page.click(GOOGLE_LOGIN.passwordNext);
    console.log("[Browser] Password entered");

    // Wait for login to complete (may need 2FA — user must handle manually)
    console.log("[Browser] Waiting for login to complete (handle 2FA if needed)...");
    await page.waitForURL((url) => !url.toString().includes("accounts.google.com"), {
      timeout: 120000,
    });

    console.log("[Browser] Google login successful!");
    await saveSession();
    return true;
  } catch (error) {
    console.error("[Browser] Login failed:", error);
    // Save debug screenshot
    try {
      const debugDir = path.join(process.cwd(), "data");
      fs.mkdirSync(debugDir, { recursive: true });
      await page.screenshot({ path: path.join(debugDir, "login-error.png"), fullPage: true });
      console.log("[Browser] Login error screenshot saved to data/login-error.png");
    } catch {}
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
