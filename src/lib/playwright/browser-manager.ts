import { chromium, Browser, BrowserContext, Page } from "playwright";
import path from "path";

const USER_DATA_DIR = process.env.PLAYWRIGHT_USER_DATA_DIR || path.join(process.cwd(), "data", "browser-profile");

let browser: Browser | null = null;
let context: BrowserContext | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: false, // Need visible browser for flow site interaction
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

export async function getContext(): Promise<BrowserContext> {
  if (!context) {
    const b = await getBrowser();
    context = await b.newContext({
      storageState: undefined, // Will use persistent cookies from user data dir
      viewport: { width: 1920, height: 1080 },
    });
  }
  return context;
}

export async function getPage(): Promise<Page> {
  const ctx = await getContext();
  const pages = ctx.pages();
  if (pages.length > 0) return pages[0];
  return ctx.newPage();
}

export async function shutdown(): Promise<void> {
  if (context) {
    await context.close();
    context = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}
