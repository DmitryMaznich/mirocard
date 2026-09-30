import { copyFileSync, cpSync, mkdirSync } from "node:fs";
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

// HEIC -> JPEG converter for photo uploads outside Safari. It's ~3 MB of
// inlined libheif wasm, and vite-plugin-singlefile would inline even a
// dynamic import() into index.html for every user, so it's served as a
// separate static file instead and loaded by <script> only when a HEIC
// photo actually needs converting (src/shared/utils/squarePhoto.js).
// Shipped unmodified alongside its licence (LGPL-3.0).
mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/heic-to/dist/iife/heic-to.js", "public/vendor/heic-to.js");
copyFileSync("node_modules/heic-to/LICENSE", "public/vendor/heic-to.LICENSE.txt");
console.log("✓ synced heic-to -> public/vendor/heic-to.js");
