import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { RELEASE_TOPIC_COPY, applyReleaseTopicCopy } from "../src/topics/releaseTopicCopy.js";

// Patch the published catalog ZIPs after their topic-specific generators run.
// Copy lives in releaseTopicCopy.js so it also refreshes previously installed
// records at runtime. --write bumps each changed deck's patch version and
// updates the catalog; --check catches ZIPs rebuilt without the editorial copy.
const write = process.argv.includes("--write");
const catalogPath = join("public", "decks", "catalog.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
let changed = 0;
let stale = 0;

function nextPatch(version) {
  const parts = version.split(".").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    throw new Error(`Expected x.y.z deck version, got ${version}`);
  }
  parts[2] += 1;
  return parts.join(".");
}

for (const entry of catalog.decks.filter((deck) => RELEASE_TOPIC_COPY[deck.id])) {
  if (entry.status !== "release") throw new Error(`${entry.id} is no longer a release topic`);
  const copy = RELEASE_TOPIC_COPY[entry.id];
  const hash = createHash("sha256").update(JSON.stringify(copy)).digest("hex").slice(0, 16);
  const oldPath = join("public", "decks", basename(entry.url));
  const zip = await JSZip.loadAsync(await readFile(oldPath));
  const manifestName = zip.file("topic.json") ? "topic.json" : "deck.json";
  const manifestFile = zip.file(manifestName);
  if (!manifestFile) throw new Error(`${entry.id}: missing manifest`);
  const original = JSON.parse(await manifestFile.async("string"));
  if (original.meta.id !== entry.id || original.meta.version !== entry.version) {
    throw new Error(`${entry.id}: catalog and ZIP manifest disagree`);
  }
  if (original.meta.copyHash === hash) continue;
  stale += 1;
  if (!write) {
    console.log(`STALE ${entry.id} ${entry.version}`);
    continue;
  }

  const version = nextPatch(entry.version);
  const manifest = applyReleaseTopicCopy(original);
  manifest.meta.version = version;
  manifest.meta.copyHash = hash;
  zip.file(manifestName, `${JSON.stringify(manifest, null, 2)}\n`);
  const filename = `${entry.id}_v${version}.zip`;
  const outputPath = join("public", "decks", filename);
  await writeFile(outputPath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } }));
  entry.version = version;
  entry.url = `./decks/${filename}`;
  if (entry.zipUrl) entry.zipUrl = filename;
  if (entry.file) entry.file = filename;
  entry.description = { ...entry.description, ru: copy.about.description };
  console.log(`UPDATED ${entry.id} ${original.meta.version} -> ${version}`);
  changed += 1;
}

if (write && changed) {
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
}
if (!write && stale) process.exitCode = 1;
console.log(`${write ? "Published" : "Checked"}: ${changed} updated, ${stale} stale`);
