import JSZip from "jszip";
import { getDb, kv, topics } from "@/core/db";
import { importTopic } from "@/topics/topicLoader";
import { getApiToken } from "@/core/api";
import { readBodyWithProgress } from "./catalogService";
import { sha256Bytes, hasInstalledPackage } from "../../../shared/topic-delivery.mjs";

async function verifiedDownload(entry, part, kind, language, onProgress) {
  if (!part?.sha256 || !Number.isSafeInteger(part.bytes)) throw new Error("Invalid download descriptor");
  const token = getApiToken();
  const url = (entry.access ?? "free") === "free" && part.url
    ? `${part.url.replace(/^\.\//, "/")}?_refresh=${Date.now()}`
    : `/api/decks/${encodeURIComponent(entry.id)}/download?part=${kind}${language ? `&language=${encodeURIComponent(language)}` : ""}&_refresh=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store", headers: (entry.access ?? "free") !== "free" && token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const bytes = await readBodyWithProgress(response, onProgress);
  if (bytes.byteLength !== part.bytes || await sha256Bytes(bytes) !== part.sha256) throw new Error("Downloaded file failed integrity check");
  return bytes;
}

export async function installTopicLanguage(entry, language, appVersion, { onProgress, coreBuffer, ensureCurrent = () => {} } = {}) {
  const db = await getDb();
  const previous = await kv.get(db, `topic:${entry.id}`);
  const delivery = entry.languageDownload;
  const part = delivery?.languages?.[language];
  if (!part) throw new Error("Language package unavailable");
  const cachedCore = await kv.get(db, `topicCore:${entry.id}`);
  const total = (coreBuffer || cachedCore?.sha256 === delivery.core.sha256 ? 0 : delivery.core.bytes)
    + (hasInstalledPackage(previous, language, part) ? 0 : part.bytes);
  let completed = 0;
  const progress = (size) => (fraction) => onProgress?.(total ? (completed + (fraction ?? 0) * size) / total : 1);
  let core = coreBuffer;
  let reusedCore = false;
  if (!core && cachedCore?.sha256 === delivery.core.sha256) {
    const cachedZip = new JSZip();
    cachedZip.file("topic.json", JSON.stringify(cachedCore.manifest));
    for (const [name, expected] of Object.entries(cachedCore.files)) {
      const file = await topics.getFile(db, entry.id, name);
      if (!file) throw new Error("Cached core file missing");
      const bytes = await file.arrayBuffer();
      if (bytes.byteLength !== expected.bytes || await sha256Bytes(bytes) !== expected.sha256) throw new Error("Cached core file damaged");
      cachedZip.file(name, bytes);
    }
    core = await cachedZip.generateAsync({ type: "arraybuffer" });
    reusedCore = true;
  }
  if (!core) core = await verifiedDownload(entry, delivery.core, "core", null, progress(delivery.core.bytes));
  if (!reusedCore && (core.byteLength !== delivery.core.bytes || await sha256Bytes(core) !== delivery.core.sha256)) throw new Error("Core failed integrity check");
  completed = total - (hasInstalledPackage(previous, language, part) ? 0 : part.bytes);
  const zip = await JSZip.loadAsync(new Uint8Array(core));
  const manifest = JSON.parse(await zip.file("topic.json")?.async("string"));
  if (manifest.meta.id !== entry.id || manifest.meta.version !== entry.version || !manifest.languageContract?.delivery) throw new Error("Core identity mismatch");
  if (Object.keys(zip.files).some((name) => !zip.files[name].dir && name.startsWith("content/"))) throw new Error("Core contains language material");

  const installedContent = {}, packages = {}, keepFiles = [];
  for (const [code, expected] of Object.entries(delivery.languages)) {
    if (!hasInstalledPackage(previous, code, expected)) continue;
    installedContent[code] = previous.languageResources.content[code];
    packages[code] = previous.installation.packages[code];
    keepFiles.push(...packages[code].files);
  }
  if (!installedContent[language]) {
    const bytes = await verifiedDownload(entry, part, "language", language, progress(part.bytes));
    const languageZip = await JSZip.loadAsync(new Uint8Array(bytes));
    const descriptor = manifest.languageContract.packages[language];
    if (!descriptor || descriptor.packageId !== part.packageId || descriptor.version !== part.version || descriptor.download.sha256 !== part.sha256) throw new Error("Language descriptor mismatch");
    const packText = await languageZip.file(descriptor.file)?.async("string");
    const pack = JSON.parse(packText);
    if (pack.language !== language || pack.packageId !== part.packageId || pack.version !== part.version) throw new Error("Language identity mismatch");
    const allowed = [descriptor.file, ...(pack.assets ?? []).map((a) => a.path)];
    for (const name of Object.keys(languageZip.files)) if (!languageZip.files[name].dir && !allowed.includes(name)) throw new Error("Unexpected file in language package");
    for (const name of allowed) {
      if (!languageZip.file(name)) throw new Error("Missing language asset");
      const data = await languageZip.file(name).async("arraybuffer");
      const asset = pack.assets?.find((a) => a.path === name);
      if (asset && (data.byteLength !== asset.bytes || await sha256Bytes(data) !== asset.sha256)) throw new Error("Language asset integrity mismatch");
      zip.file(name, data);
    }
    packages[language] = { sha256: part.sha256, version: part.version, files: allowed };
  }
  ensureCurrent();
  // All downloads and validation happen before the single IndexedDB transaction.
  const record = await importTopic(db, await zip.generateAsync({ type: "arraybuffer" }), appVersion, {
    origin: previous?.meta.origin ?? entry.origin,
    installedContent, keepFiles, coreBuffer: core,
    installation: { coreSha256: delivery.core.sha256, coreBytes: delivery.core.bytes, access: entry.access ?? "free", packages },
  });
  onProgress?.(1);
  return record;
}
