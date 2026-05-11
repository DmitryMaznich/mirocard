import JSZip from "jszip";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

const topicJson = readFileSync(join(__dir, "topic.json"), "utf-8");
const avatarSvg = readFileSync(join(__dir, "media", "avatar.svg"));

const zip = new JSZip();
zip.file("topic.json", topicJson);
zip.file("media/avatar.svg", avatarSvg);

const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
const outPath = join(__dir, "sentence_puzzle.zip");
writeFileSync(outPath, buffer);
console.log("✓ Built:", outPath);
