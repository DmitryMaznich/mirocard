import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// These checks cover site-side prerequisites. Only Firefox for Android on a
// device can confirm that a pinned icon launches its standalone PWA activity.
export function checkManifest(manifest, manifestUrl, pageUrl) {
  const errors = [];
  if (!(manifest.name || manifest.short_name)?.trim()) errors.push("Missing app name");
  if (!["standalone", "fullscreen"].includes(manifest.display)) errors.push("Expected a display mode without browser UI");
  let start;
  let scope;
  try {
    start = new URL(manifest.start_url, manifestUrl);
    scope = new URL(manifest.scope, manifestUrl);
    if (start.origin !== new URL(pageUrl).origin || scope.origin !== start.origin) errors.push("Start URL and scope must stay on the app origin");
    if (!start.pathname.startsWith(scope.pathname)) errors.push("Start URL is outside app scope");
  } catch {
    errors.push("Invalid start URL or scope");
  }
  if (!manifest.start_url || !manifest.scope) errors.push("Missing explicit start_url or scope");
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const hasLargeIcon = icons.some((icon) => {
    const purposes = (icon.purpose || "any").split(/\s+/);
    return purposes.some((purpose) => ["any", "maskable"].includes(purpose)) &&
      (icon.sizes || "").split(/\s+/).some((size) => {
        const match = /^(\d+)x(\d+)$/.exec(size);
        return match && Math.min(Number(match[1]), Number(match[2])) >= 192;
      });
  });
  if (!hasLargeIcon) errors.push("Firefox needs an any/maskable icon of at least 192x192");
  return errors;
}

export async function verifyPwa({ localRoot, baseUrl = "https://app.mironium.com/" } = {}) {
  const pageUrl = new URL(baseUrl);
  if (pageUrl.protocol !== "https:") throw new Error("The app must use HTTPS");
  const checks = [];
  async function load(url, contentType) {
    if (url.origin !== pageUrl.origin) throw new Error(`Unexpected external app resource: ${url.href}`);
    if (localRoot) {
      const pathname = decodeURIComponent(url.pathname);
      const relative = pathname === "/" ? "index.html" : `public/${pathname.slice(1)}`;
      const absolute = path.resolve(localRoot, relative);
      if (!absolute.startsWith(`${path.resolve(localRoot)}${path.sep}`)) throw new Error("Resource escaped project root");
      return readFile(absolute);
    }
    const response = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`${url.pathname}: HTTP ${response.status}`);
    if (new URL(response.url).origin !== pageUrl.origin) throw new Error(`${url.pathname}: redirected outside app origin`);
    if (!contentType.test(response.headers.get("content-type") || "")) throw new Error(`${url.pathname}: unexpected Content-Type ${response.headers.get("content-type")}`);
    return Buffer.from(await response.arrayBuffer());
  }
  const html = (await load(pageUrl, /text\/html/i)).toString("utf8");
  const links = html.match(/<link\b[^>]*>/gi) || [];
  const manifestLink = links.find((link) => /\brel\s*=\s*["']manifest["']/i.test(link));
  const href = manifestLink?.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!href) throw new Error("Page does not link a manifest");
  const manifestUrl = new URL(href, pageUrl);
  const manifest = JSON.parse((await load(manifestUrl, /application\/(?:manifest\+)?json/i)).toString("utf8"));
  const errors = checkManifest(manifest, manifestUrl, pageUrl);
  if (errors.length) throw new Error(errors.join("; "));
  checks.push("HTML links a valid manifest; standalone display, same-origin start URL and scope, Firefox-sized icon declarations");

  await Promise.all(manifest.icons.map(async (icon) => {
    const bytes = await load(new URL(icon.src, manifestUrl), /image\/png/i);
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) throw new Error(`${icon.src}: not a PNG image (possibly SPA HTML fallback)`);
    const dimensions = `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
    if (!icon.sizes.split(/\s+/).includes(dimensions)) throw new Error(`${icon.src}: actual ${dimensions} differs from manifest ${icon.sizes}`);
  }));
  checks.push("All declared PNG icons load and match their declared dimensions");

  const worker = (await load(new URL("/sw.js", pageUrl), /(?:application|text)\/(?:java|ecma)script/i)).toString("utf8");
  if (!/addEventListener\(\s*["']fetch["']/.test(worker)) throw new Error("Service worker resource has no fetch handler (possibly SPA fallback)");
  checks.push("Service worker script loads with a fetch handler; runtime registration still requires a device check");
  if (!localRoot) {
    await load(new URL(manifest.start_url, manifestUrl), /text\/html/i);
    checks.push("Manifest start URL serves HTML on the app origin");
  }
  return { mode: localRoot ? "source" : "live", baseUrl: pageUrl.href, checks, limitation: "Passing prerequisites does not prove Firefox recognized the manifest or created a standalone launcher on a device." };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const localRoot = process.argv.includes("--local") ? path.resolve(fileURLToPath(new URL("..", import.meta.url))) : undefined;
  try {
    const result = await verifyPwa({ localRoot, baseUrl: process.env.MIROCARD_PUBLIC_URL || "https://app.mironium.com/" });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`PWA prerequisites failed: ${error.message}`);
    process.exitCode = 1;
  }
}
