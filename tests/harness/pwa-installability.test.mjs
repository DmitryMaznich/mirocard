import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { checkManifest } from "../../scripts/verify-pwa-installability.mjs";

const manifest = JSON.parse(await readFile(new URL("../../public/manifest.json", import.meta.url), "utf8"));
const manifestUrl = "https://app.mironium.com/manifest.json";
const pageUrl = "https://app.mironium.com/";

test("Mironium declares the requirements Firefox Android uses for a standalone launcher", () => {
  assert.deepEqual(checkManifest(manifest, manifestUrl, pageUrl), []);
});

test("a browser-mode manifest cannot silently pass as a standalone app", () => {
  assert.ok(checkManifest({ ...manifest, display: "browser" }, manifestUrl, pageUrl).some((error) => error.includes("display mode")));
});

test("an icon below Firefox's minimum is rejected even if a browser can make a bookmark", () => {
  assert.ok(checkManifest({ ...manifest, icons: [{ src: "/favicon.png", sizes: "48x48" }] }, manifestUrl, pageUrl).some((error) => error.includes("192x192")));
});

test("a start URL outside the app's trusted scope is rejected", () => {
  assert.ok(checkManifest({ ...manifest, start_url: "https://mironium.com/" }, manifestUrl, pageUrl).some((error) => error.includes("origin")));
  assert.ok(checkManifest({ ...manifest, scope: "/lessons/" }, manifestUrl, pageUrl).some((error) => error.includes("scope")));
});
