import { copyFileSync, cpSync } from "node:fs";
import { buildFiguresGallery } from "../tools/symmetry_draw/build-figures-gallery.mjs";

buildFiguresGallery();

const CAPTURE_TOOLS = [
  ["tools/letter_capture/handwriting_capture.html", "public/letter_capture.html"],
  ["tools/figure_capture/figure_capture.html", "public/figure_capture.html"],
  ["tools/figure_capture/figures_gallery.html", "public/figures_gallery.html"],
];

for (const [source, destination] of CAPTURE_TOOLS) {
  copyFileSync(source, destination);
  console.log(`✓ synced ${source} -> ${destination}`);
}

// The gallery's JSON buttons use this public path. Keep the editable source
// files in tools/, then stage a build-only copy alongside the hosted pages.
cpSync("tools/symmetry_draw/figures", "public/symmetry_draw/figures", {
  recursive: true,
  force: true,
});
console.log("✓ synced tools/symmetry_draw/figures -> public/symmetry_draw/figures");
