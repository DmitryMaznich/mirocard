import JSZip from "jszip";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

function addDirectory(zip, source, relative = "") {
  if (!existsSync(source)) return;
  for (const name of readdirSync(source)) {
    const file = join(source, name);
    const archivePath = relative ? `${relative}/${name}` : name;
    if (statSync(file).isDirectory()) addDirectory(zip, file, archivePath);
    else zip.file(archivePath, readFileSync(file));
  }
}

export async function createSymmetryDrawDeckBuffer(topicJson = readFileSync(join(dir, "topic.json"))) {
  const zip = new JSZip();
  zip.file("topic.json", topicJson);
  zip.file("renderer", readFileSync(join(dir, "renderer.js")));
  zip.file("mirocard2.css", readFileSync(join(dir, "renderer.css")));
  zip.file("media/avatar.svg", readFileSync(join(dir, "media", "avatar.svg")));
  zip.file("media/repeat_avatar.svg", readFileSync(join(dir, "media", "repeat_avatar.svg")));
  zip.file("media/dictation_avatar.svg", readFileSync(join(dir, "media", "dictation_avatar.svg")));
  zip.file("media/navigator_avatar.svg", readFileSync(join(dir, "media", "navigator_avatar.svg")));
  zip.file("media/coordinates_avatar.svg", readFileSync(join(dir, "media", "coordinates_avatar.svg")));
  zip.file("media/symmetry_avatar.svg", readFileSync(join(dir, "media", "symmetry_avatar.svg")));
  // Voice commands are optional during development, but when generated they
  // travel inside the same downloadable deck and work without network access.
  addDirectory(zip, join(dir, "audio"), "audio");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function buildSymmetryDrawDeck(output = join(dir, "symmetry_draw.zip")) {
  writeFileSync(output, await createSymmetryDrawDeckBuffer());
  console.log(`Built ${output}`);
  return output;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) await buildSymmetryDrawDeck();
