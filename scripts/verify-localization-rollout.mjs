#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export async function verifyRollout({ baseUrl, expectedSha = "", expectedVersion = "", requireLanguagePicker = false, fetcher = fetch }) {
  async function get(pathname) {
    const response = await fetcher(new URL(pathname, baseUrl), { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(pathname + ": HTTP " + response.status);
    return response;
  }
  const [page, versionResponse, healthResponse, catalogResponse] = await Promise.all([
    get("/"), get("/api/version"), get("/api/healthz"), get("/api/decks/catalog"),
  ]);
  const [html, version, health, catalog] = await Promise.all([page.text(), versionResponse.json(), healthResponse.json(), catalogResponse.json()]);
  if (expectedSha && version.gitSha !== expectedSha) throw new Error("Awaiting commit " + expectedSha + "; serving " + version.gitSha);
  if (expectedVersion && version.version !== expectedVersion) throw new Error("Unexpected app version: " + version.version);
  if (health.status !== "ok" || health.db !== true) throw new Error("Application health check failed");
  if (health.gitSha !== version.gitSha || health.version !== version.version) throw new Error("Version and health responses disagree");
  if (!Array.isArray(catalog.decks)) throw new Error("Deck catalog is not a valid catalog");
  if (!html.includes('id="root"')) throw new Error("Application HTML shell is missing");
  if (requireLanguagePicker && !html.includes("mironium.uiLanguage")) throw new Error("Localization bootstrap is missing from the built HTML");
  return { version: version.version, gitSha: version.gitSha, health: health.status, catalogEntries: catalog.decks.length };
}

async function main() {
  const expectedSha = process.env.MIROCARD_EXPECTED_SHA || "";
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const options = {
    baseUrl: process.env.MIROCARD_PUBLIC_URL || "https://app.mironium.com",
    expectedSha,
    expectedVersion: expectedSha ? packageJson.version : "",
    requireLanguagePicker: process.env.MIROCARD_EXPECT_LOCALIZATION === "1",
  };
  const deadline = Date.now() + (expectedSha ? 8 * 60 * 1000 : 0);
  while (true) {
    try {
      console.log("Verified Railway application:", JSON.stringify(await verifyRollout(options)));
      return;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      console.log("Rollout pending:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
