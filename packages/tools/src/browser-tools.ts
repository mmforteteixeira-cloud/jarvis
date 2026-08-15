import { chromium, type Browser, type Page } from "playwright";
import { createLogger } from "@jarvis/shared";

const logger = createLogger("tools:browser");
const FALLBACK_EXECUTABLE = "/opt/pw-browsers/chromium";

export interface BrowserNavigateResult {
  url: string;
  title: string;
  textContent: string;
}

/**
 * Real Browser Agent primitive, backed by Playwright + the pre-installed
 * Chromium in this environment. Each call launches a fresh headless browser
 * and closes it — simple and safe for now; a persistent-context pool is a
 * natural follow-up once the Browser Agent needs multi-step sessions.
 */
export class BrowserTools {
  private async launch(): Promise<Browser> {
    // Outbound HTTPS in some deployments (including this dev sandbox) goes
    // through a policy-enforcing proxy that re-terminates TLS. Chromium
    // needs to be told about both explicitly — Node's own fetch() picks
    // this up from env vars automatically, but the browser process does not.
    const proxyServer = process.env.HTTPS_PROXY ?? process.env.https_proxy;
    const launchOptions = {
      headless: true,
      ...(proxyServer ? { proxy: { server: proxyServer }, args: ["--ignore-certificate-errors"] } : {}),
    };

    try {
      // Prefer the pinned, pre-installed Chromium build over whatever
      // revision the installed `playwright` package happens to expect —
      // avoids "browser not found" when the two drift apart.
      return await chromium.launch({ ...launchOptions, executablePath: FALLBACK_EXECUTABLE });
    } catch (err) {
      logger.warn("Pinned Chromium launch failed, retrying with Playwright's default resolution", {
        error: (err as Error).message,
      });
      return chromium.launch(launchOptions);
    }
  }

  async navigateAndRead(url: string): Promise<BrowserNavigateResult> {
    const browser = await this.launch();
    try {
      const page: Page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      const title = await page.title();
      const textContent = (await page.locator("body").innerText()).slice(0, 20_000);
      return { url: page.url(), title, textContent };
    } finally {
      await browser.close();
    }
  }

  async screenshot(url: string): Promise<Buffer> {
    const browser = await this.launch();
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      return await page.screenshot({ type: "png" });
    } finally {
      await browser.close();
    }
  }
}
