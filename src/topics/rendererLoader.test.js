import { afterEach, expect, it } from "vitest";
import JSZip from "jszip";
import { getDb } from "@/core/db";
import { importTopic } from "./topicLoader";
import { clearRendererCache, loadRenderer } from "./rendererLoader";

afterEach(() => { clearRendererCache(); delete window.__MirocardRenderer; });

async function archive(id, version) {
  const zip = new JSZip();
  zip.file("topic.json", JSON.stringify({ meta: { id, version, renderer: "cache_test" }, modes: [], cards: [{ id: "one", conceptId: "one" }] }));
  zip.file("renderer", `window.__MirocardRenderer = function Renderer() { return "${version}"; };`);
  zip.file("mirocard2.css", `.renderer-${id} { --version: "${version}"; }`);
  return zip.generateAsync({ type: "arraybuffer" });
}

it("re-import replaces its cached renderer/CSS without clearing another topic", async () => {
  const db = await getDb();
  await importTopic(db, await archive("cache_updated", "1.0.0"));
  await importTopic(db, await archive("cache_other", "1.0.0"));
  const first = await loadRenderer("cache_updated");
  const other = await loadRenderer("cache_other");
  expect(first()).toBe("1.0.0");
  await importTopic(db, await archive("cache_updated", "2.0.0"));
  const second = await loadRenderer("cache_updated");
  expect(second()).toBe("2.0.0");
  expect(second).not.toBe(first);
  expect(await loadRenderer("cache_other")).toBe(other);
  expect(document.getElementById("mirocard-renderer-css-cache_updated").textContent).toContain("2.0.0");
});
