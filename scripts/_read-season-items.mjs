import JSZip from "jszip";
import { readFileSync } from "fs";
const raw = readFileSync("public/decks/word_formation_soup_v1.0.34.zip");
const zip = await JSZip.loadAsync(raw);
const json = await zip.file("topic.json").async("text");
const data = JSON.parse(json);
data.cards.filter(c => c.type === "season_overview").forEach(c => {
  console.log("\n=== " + c.id + " ===");
  (c.items || []).forEach((it, i) => console.log(i, it.id, "|", it.adjPhrase, "|", it.image));
});
