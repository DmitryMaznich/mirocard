import { firefox } from "@playwright/test";

// Desktop Gecko smoke test. This cannot exercise Android's launcher or prove
// that Firefox for Android offers Install on a specific phone.
//
// This checks the live site, and CI runs on the same push that makes Railway redeploy it: while
// Railway swaps the container the site answers 502 for a few seconds. So a failed check is retried
// for up to RETRY_FOR_MS before CI fails -- a site that is really broken still fails, just later.
const RETRY_FOR_MS = 3 * 60 * 1000;
const RETRY_PAUSE_MS = 20 * 1000;

async function checkOnce(browser) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const response = await page.goto(process.env.MIROCARD_PUBLIC_URL || "https://app.mironium.com/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!response?.ok()) throw new Error(`App page: HTTP ${response?.status()}`);
    const report = await page.evaluate(async () => {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Firefox PWA resource/worker check timed out")), 25000));
      return Promise.race([timeout, (async () => {
        if (!window.isSecureContext) throw new Error("Page is not a secure context");
        const link = document.querySelector('link[rel="manifest"]');
        if (!link) throw new Error("No manifest link in the loaded document");
        const response = await fetch(link.href, { cache: "no-store" });
        if (!response.ok) throw new Error(`Manifest: HTTP ${response.status}`);
        const manifest = await response.json();
        if (manifest.display !== "standalone") throw new Error("Manifest does not request standalone display");
        const manifestUrl = response.url;
        if (new URL(manifest.start_url, manifestUrl).origin !== location.origin) throw new Error("External start URL");
        const icons = await Promise.all(manifest.icons.map(async (icon) => {
          const image = new Image();
          image.src = new URL(icon.src, manifestUrl).href;
          await image.decode();
          const dimensions = `${image.naturalWidth}x${image.naturalHeight}`;
          if (!icon.sizes.split(/\s+/).includes(dimensions)) throw new Error("Firefox decoded icon dimensions differ from manifest");
          return dimensions;
        }));
        const registration = await navigator.serviceWorker.ready;
        if (new URL(registration.scope).pathname !== "/") throw new Error("Unexpected service worker scope");
        if (!registration.active || new URL(registration.active.scriptURL).pathname !== "/sw.js") throw new Error("Expected active app service worker");
        return {
          engine: navigator.userAgent,
          manifest: { name: manifest.name, display: manifest.display, start_url: manifest.start_url, scope: manifest.scope },
          decodedIcons: icons,
          activeServiceWorker: true,
          limitation: "Desktop Firefox verified resource loading and service worker activation. Android install recognition and standalone launch still need a phone.",
        };
      })()]);
    });
    return report;
  } finally {
    await context.close();
  }
}

const browser = await firefox.launch({ headless: true });
try {
  const deadline = Date.now() + RETRY_FOR_MS;
  for (let attempt = 1; ; attempt += 1) {
    try {
      const report = await checkOnce(browser);
      console.log(JSON.stringify(report, null, 2));
      break;
    } catch (error) {
      if (Date.now() + RETRY_PAUSE_MS > deadline) throw error;
      console.warn(`Attempt ${attempt} failed (${error.message}); the site may be redeploying, retrying in ${RETRY_PAUSE_MS / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
    }
  }
} finally {
  await browser.close();
}
