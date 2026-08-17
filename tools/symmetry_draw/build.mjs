import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const zip = new JSZip();
const repeatArtworkFiles = [
  ["repeat_seahorse_worksheet", "repeat_duck_tail_vector.svg"],
  ["repeat_person_worksheet", "repeat_beetle_vector.svg"],
  ["repeat_squirrel_worksheet", "repeat_squirrel_vector.svg"],
  ["repeat_elephant_worksheet", "repeat_elephant_vector.svg"],
  ["repeat_bull_worksheet", "repeat_bull_vector.svg"],
];
const repeatArtwork = Object.fromEntries(repeatArtworkFiles.map(([id, file]) => {
  const svg = readFileSync(join(dir, "media", file), "utf8");
  const [, width, height] = /<svg[^>]*\bwidth="([\d.]+)"\s+height="([\d.]+)"/.exec(svg) ?? [];
  const paths = [...svg.matchAll(/<path\s+d="([^"]+)"/g)].map((match) => match[1]);
  if (!width || !height || !paths.length) throw new Error(`Could not read repeat artwork ${file}`);
  return [id, { width: Number(width), height: Number(height), paths }];
}));
const renderer = `window.__MirocardRepeatArtwork = ${JSON.stringify(repeatArtwork)};\n${readFileSync(join(dir, "renderer.js"), "utf8")}`;
zip.file("topic.json", readFileSync(join(dir, "topic.json")));
zip.file("renderer", renderer);
zip.file("mirocard2.css", readFileSync(join(dir, "renderer.css")));
zip.file("media/avatar.svg", readFileSync(join(dir, "media", "avatar.svg")));
zip.file("media/repeat_avatar.svg", readFileSync(join(dir, "media", "repeat_avatar.svg")));
zip.file("media/dictation_avatar.svg", readFileSync(join(dir, "media", "dictation_avatar.svg")));
zip.file("media/navigator_avatar.svg", readFileSync(join(dir, "media", "navigator_avatar.svg")));
zip.file("media/coordinates_avatar.svg", readFileSync(join(dir, "media", "coordinates_avatar.svg")));
zip.file("media/symmetry_avatar.svg", readFileSync(join(dir, "media", "symmetry_avatar.svg")));

const output = join(dir, "symmetry_draw.zip");
writeFileSync(output, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`Built ${output}`);
