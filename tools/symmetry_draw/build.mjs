import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const zip = new JSZip();
const traceImages = Object.fromEntries([
  ["repeat_duck_worksheet", "repeat_duck_trace.png"],
  ["repeat_seahorse_worksheet", "repeat_duck_tail_trace.png"],
  ["repeat_person_worksheet", "repeat_beetle_trace.png"],
  ["repeat_squirrel_worksheet", "repeat_squirrel_trace.png"],
  ["repeat_elephant_worksheet", "repeat_elephant_trace.png"],
  ["repeat_bull_worksheet", "repeat_bull_trace.png"],
].map(([id, file]) => [id, `data:image/png;base64,${readFileSync(join(dir, "media", file)).toString("base64")}`]));
const renderer = `window.__MirocardTraceImages = ${JSON.stringify(traceImages)};\n${readFileSync(join(dir, "renderer.js"), "utf8")}`;

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
