import JSZip from "jszip";
import { importTopic } from "@/topics/topicLoader";
import { sha256Bytes, topicDownloadDescriptor } from "../../../shared/topic-delivery.mjs";
import { requestTopicLanguage } from "./topicLanguageChoice.js";

export async function importTopicArchive(db, buffer, appVersion) {
  const zip = await JSZip.loadAsync(buffer);
  const raw = await zip.file("topic.json")?.async("string");
  const manifest = raw ? JSON.parse(raw) : null;
  if (!manifest?.languageContract?.delivery) return importTopic(db, buffer, appVersion, { origin: "imported" });
  const record = { ...manifest, installation: { coreSha256: await sha256Bytes(buffer), coreBytes: buffer.byteLength } };
  return requestTopicLanguage({ coreBuffer: buffer, entry: {
    id: manifest.meta.id, version: manifest.meta.version, title: manifest.meta.title,
    access: "free", origin: "imported", languageDownload: topicDownloadDescriptor(record),
  } });
}
