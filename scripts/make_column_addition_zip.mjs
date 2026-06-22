import { createWriteStream } from "fs";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const manifest = JSON.parse(
  readFileSync(resolve(root, "public/column_addition_topic.json"), "utf8")
);

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));

const version = manifest.meta.version;
const outFile = resolve(root, `public/column_addition_v${version}.zip`);

zip
  .generateNodeStream({ type: "nodebuffer", streamFiles: true })
  .pipe(createWriteStream(outFile))
  .on("finish", () => {
    console.log(`✓ Created ${outFile}`);
  });
