import JSZip from "jszip";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { planLesson } from "../../src/topics/renderers/drawing/lessonPlan.js";

const base = new URL("./", import.meta.url);
const root = fileURLToPath(new URL("../../", base));
const manifest = JSON.parse(await readFile(new URL("topic.json", base), "utf8"));
const pencils = JSON.parse(await readFile(new URL("pencils.json", base), "utf8"));
for (const card of manifest.cards) {
  card.lesson = planLesson(JSON.parse(await readFile(new URL(card.lessonFile, base), "utf8")), pencils);
  if (card.lesson.id !== card.id || !card.lesson.steps?.length) throw new Error(`Invalid drawing lesson: ${card.id}`);
  delete card.lessonFile;
}
execFileSync("npm", ["run", "build:renderer"], { cwd: root, env: { ...process.env, RENDERER: "drawing" }, stdio: "inherit" });
const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));
zip.file("renderer", await readFile(new URL("dist/renderer", base)));
zip.file("mirocard2.css", await readFile(new URL("dist/mirocard2.css", base)));
zip.file("media/avatar.svg", await readFile(new URL("media/avatar.svg", base)));
// Covers are generated from the same lesson paths; no separate artwork to maintain.
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
for (const card of manifest.cards) {
  const parts = [], strokes = [], overlays = [], defs = [];
  card.lesson.steps.forEach((step, i) => {
    if (step.kind === "stroke") for (const item of step.paths) {
      const path = typeof item === "string" ? { d: item } : item;
      strokes.push(`<path d="${escape(path.d)}" fill="${escape(path.fill ?? "none")}"/>`);
    } else {
      if (step.clip) defs.push(`<clipPath id="clip-${i}"><path d="${escape(step.clip)}"/></clipPath>`);
      const shape = `<path d="${escape(step.d)}" fill="${escape(step.fill)}" fill-rule="evenodd" stroke="none"${step.clip ? ` clip-path="url(#clip-${i})"` : ""}/>`;
      (step.overlay ? overlays : parts).push(shape);
    }
  });
  const cover = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${escape(card.lesson.viewBox)}"><defs>${defs.join("")}</defs><g>${parts.join("")}</g><g stroke="#26352d" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${strokes.join("")}</g>${overlays.join("")}</svg>`;
  zip.file(card.image, cover);
}
const output = new URL(`../../public/decks/drawing_v${manifest.meta.version}.zip`, base);
await mkdir(new URL("./", output), { recursive: true });
await writeFile(output, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`Built ${fileURLToPath(output)}: ${manifest.cards.length} drawing(s)`);
