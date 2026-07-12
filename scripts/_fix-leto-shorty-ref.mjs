import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DECKS = path.join(__dirname, "..", "public", "decks");

const zips = fs.readdirSync(DECKS)
  .filter(f => f.startsWith("word_formation_soup_v") && f.endsWith(".zip"))
  .sort((a, b) => {
    const v = s => s.match(/v(\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number) ?? [0,0,0];
    const [a1,a2,a3]=v(a),[b1,b2,b3]=v(b);
    return a1-b1||a2-b2||a3-b3;
  });
const srcName = zips[zips.length - 1];
console.log(`Source: ${srcName}`);

const zip = await JSZip.loadAsync(fs.readFileSync(path.join(DECKS, srcName)));
const data = JSON.parse(await zip.file("topic.json").async("text"));

const letoCard = data.cards.find(c => c.id === "sea_leto_overview");
const shortyItem = letoCard.items.find(i => i.image === "media/sea_leto_shorty_ingredient.webp");
console.log("Before:", shortyItem.image);
shortyItem.image = "media/item_leto_shorty.webp";
console.log("After:", shortyItem.image);

const [maj, min, pat] = data.version.split(".").map(Number);
const newVer = `${maj}.${min}.${pat + 1}`;
data.version = newVer;
data.meta.version = newVer;
zip.file("topic.json", JSON.stringify(data, null, 2));

const outName = `word_formation_soup_v${newVer}.zip`;
const outBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
fs.writeFileSync(path.join(DECKS, outName), outBuf);
fs.unlinkSync(path.join(DECKS, srcName));

const catPath = path.join(DECKS, "catalog.json");
const catalog = JSON.parse(fs.readFileSync(catPath, "utf8"));
const entry = catalog.decks.find(d => d.id === "word_formation_soup");
entry.version = newVer; entry.file = outName;
entry.url = `/decks/${outName}`; entry.zipUrl = `/decks/${outName}`;
fs.writeFileSync(catPath, JSON.stringify(catalog, null, 2));

console.log(`Done → ${outName} (v${newVer})`);
