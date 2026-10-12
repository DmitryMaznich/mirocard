import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "content/topics"),
  out = path.join(root, "public/decks");
for (const name of fs.readdirSync(source)) {
  const file = path.join(source, name, "topic.json");
  if (!fs.existsSync(file)) continue;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data.meta?.renderer !== "chat_practice") continue;
  if (
    !/^[a-z0-9_]+$/.test(data.meta.id) ||
    !/^\d+\.\d+\.\d+$/.test(data.meta.version)
  )
    throw new Error(`Invalid identity: ${name}`);
  const scripts = data.modes?.length
    ? data.modes.map((m) => data.scripts?.[m.id])
    : [data];
  for (const script of scripts) {
    if (!script?.turns?.length) throw new Error(`${name}: missing dialogue`);
    const ids = new Set(script.turns.map((t) => t.id));
    if (ids.size !== script.turns.length)
      throw new Error(`${name}: duplicate turn IDs`);
    for (const turn of script.turns)
      for (const choice of turn.choices ?? [])
        if (choice.next && !ids.has(choice.next))
          throw new Error(`${name}: missing next turn ${choice.next}`);
  }
  const zip = new JSZip();
  zip.file("topic.json", JSON.stringify(data, null, 2) + "\n", {
    date: new Date("2026-01-01T00:00:00Z"),
  });
  const output = path.join(out, `${data.meta.id}_v${data.meta.version}.zip`);
  fs.writeFileSync(
    output,
    await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
  );
  console.log(
    `Prepared ${data.meta.id} ${data.meta.version}: ${scripts.length} dialogue(s)`,
  );
}
