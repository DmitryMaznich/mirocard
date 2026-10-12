import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog =
  JSON.parse(
    fs.readFileSync(path.join(root, "public/decks/catalog.json"), "utf8"),
  ).decks ?? [];
if (!fs.existsSync(path.join(root, ".git"))) {
  console.log(
    "Topic inventory: using committed inventory (Git metadata unavailable)",
  );
  if (!fs.existsSync(path.join(root, "backend/generated/topic-inventory.json")))
    throw new Error("Topic inventory missing; generate it before deployment");
  process.exit(0);
}
const files = execFileSync("git", ["ls-files"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
})
  .trim()
  .split("\n");
const records = new Map();
const versionCompare = (a, b) => {
  const x = String(a ?? "0")
      .split(/[.-]/)
      .map(Number),
    y = String(b ?? "0")
      .split(/[.-]/)
      .map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const n = (x[i] || 0) - (y[i] || 0);
    if (n) return n;
  }
  return 0;
};
function add(meta, source, zipUrl = null, record = {}) {
  if (!meta?.id) return;
  let item = records.get(meta.id);
  if (!item) {
    item = {
      id: meta.id,
      title: meta.title ?? meta.id,
      version: meta.version ?? null,
      renderer: meta.renderer ?? null,
      sources: [],
      bundle: null,
      builtin: false,
    };
    records.set(meta.id, item);
  }
  item.sources.push(source);
  if (versionCompare(meta.version, item.version) >= 0) {
    item.version = meta.version ?? item.version;
    item.title = meta.title ?? item.title;
    item.renderer = meta.renderer ?? item.renderer;
  }
  if (
    zipUrl &&
    (!item.bundle || versionCompare(meta.version, item.bundle.version) > 0)
  )
    item.bundle = {
      version: meta.version,
      url: zipUrl,
      title: meta.title ?? meta.id,
      description: meta.about?.description ?? meta.description ?? null,
      renderer: meta.renderer ?? null,
      modes: record.modes?.length ?? null,
      cards: record.cards?.length ?? null,
    };
}
for (const source of files.filter(
  (f) => f.endsWith("/topic.json") && /^(tools|content|src)\//.test(f),
)) {
  const data = JSON.parse(fs.readFileSync(path.join(root, source), "utf8"));
  add(data.meta ?? data, source, null, data);
}
const latest = new Map();
for (const source of files.filter((f) => /^public\/.*\.zip$/.test(f))) {
  const match = path.basename(source).match(/^(.*)_v(\d[\d.]*)\.zip$/);
  const key = match?.[1] ?? source;
  if (
    !latest.has(key) ||
    versionCompare(match?.[2], latest.get(key).version) > 0
  )
    latest.set(key, { source, version: match?.[2] });
}
const warnings = [];
for (const { source } of latest.values()) {
  try {
    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(root, source)));
    const entry = zip.file("topic.json") ?? zip.file("deck.json");
    if (!entry) {
      warnings.push(`${source}: нет topic.json`);
      continue;
    }
    const record = JSON.parse(await entry.async("string"));
    add(record.meta ?? record, source, "./" + source.slice(7), record);
  } catch (e) {
    warnings.push(`${source}: ${e.message}`);
  }
}
for (const source of [
  "src/topics/builtinTopics.js",
  "src/topics/builtinDailyOrientationTopic.js",
  "src/topics/builtinMyPeopleTopic.js",
  "src/topics/builtinRecipesTopic.js",
]) {
  const text = fs.readFileSync(path.join(root, source), "utf8");
  const meta = text.slice(text.indexOf("meta:"));
  const constantId = meta.match(/id:\s*([A-Z_]+)/)?.[1];
  const resolvedId = constantId
    ? text.match(new RegExp(`const ${constantId} = ["']([^"']+)`))?.[1]
    : null;
  const id = resolvedId ?? meta.match(/id:\s*["']([^"']+)/)?.[1],
    version = meta.match(/version:\s*["']([^"']+)/)?.[1];
  const title = meta.match(/title:\s*(?:\{\s*ru:\s*)?["']([^"']+)/)?.[1];
  if (id) {
    add({ id, version, title }, source);
    records.get(id).builtin = true;
  }
}
for (const entry of catalog) {
  const row = records.get(entry.id) ?? {
    id: entry.id,
    title: entry.title,
    version: entry.version,
    renderer: entry.renderer ?? null,
    sources: [],
    bundle: null,
    builtin: false,
  };
  row.catalogEntry = entry;
  records.set(entry.id, row);
}
// A standalone renderer with no manifest is still visible as an unfinished topic.
const knownRenderers = new Set(
  [...records.values()].flatMap((r) => [r.renderer, r.id]),
);
for (const source of files.filter((f) =>
  /^src\/topics\/renderers\/[^/]+\/index\.jsx$/.test(f),
)) {
  const id = source.split("/")[3];
  if (
    knownRenderers.has(id) ||
    ["flashcards", "reading", "function_cards"].includes(id)
  )
    continue;
  add({ id, title: id }, source);
}
for (const row of records.values()) {
  const rendererPath = row.renderer
    ? `src/topics/renderers/${row.renderer}`
    : `src/topics/renderers/${row.id}`;
  if (files.some((f) => f.startsWith(rendererPath + "/")))
    row.sources.push(rendererPath);
  row.sources = [...new Set(row.sources)].sort();
  row.sourceUpdatedAt = row.sources.length
    ? execFileSync("git", ["log", "-1", "--format=%cI", "--", ...row.sources], {
        cwd: root,
        encoding: "utf8",
      }).trim() || null
    : null;
}
const output = path.join(root, "backend/generated/topic-inventory.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(
  output,
  JSON.stringify(
    {
      topics: [...records.values()].sort((a, b) => a.id.localeCompare(b.id)),
      warnings,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Topic inventory: ${records.size} topics, ${catalog.length} catalog entries, ${warnings.length} manifest warnings`,
);
