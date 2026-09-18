import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import { figureCards, readTopic } from "../symmetry_draw/figure-jsons.mjs";

const workshopHtml = readFileSync(new URL("./figure_capture.html", import.meta.url), "utf8");

function openFromGallery(card, { transfer = "query" } = {}) {
  const serializedCard = JSON.stringify(card);
  return new JSDOM(workshopHtml, {
    // The production and local tools both use the exact same query-card path.
    // An http origin only gives JSDOM a normal localStorage implementation.
    url: transfer === "query"
      ? `https://workshop.test/figure_capture.html?card=${encodeURIComponent(serializedCard)}`
      : "https://workshop.test/figure_capture.html",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.matchMedia = () => ({ matches: false, addEventListener() {} });
      window.requestAnimationFrame = () => 0;
      if (transfer === "window-name") window.name = `mirocard-grid-figure:${serializedCard}`;
    },
  });
}

test("every gallery figure can be added to the workshop set", () => {
  for (const card of figureCards(readTopic())) {
    const dom = openFromGallery(card);
    const { document, localStorage } = dom.window;
    const errors = [...document.querySelectorAll(".check--bad")].map((node) => node.textContent.trim());

    assert.deepEqual(errors, [], `${card.id} opened with validation errors: ${errors.join("; ")}`);
    document.getElementById("addToSetBtn").click();

    assert.match(document.getElementById("notice").textContent, /Карточка добавлена в набор/);
    assert.equal(JSON.parse(localStorage.getItem("mirocard_grid_figure_collection_v1"))[0].id, card.id);
    dom.window.close();
  }
});

test("the workshop restores a gallery figure when an embedded browser drops its query", () => {
  const card = figureCards(readTopic()).find((item) => item.id === "yachta");
  const dom = openFromGallery(card, { transfer: "window-name" });
  const { document, localStorage } = dom.window;

  assert.deepEqual([...document.querySelectorAll(".check--bad")], []);
  document.getElementById("addToSetBtn").click();
  assert.equal(JSON.parse(localStorage.getItem("mirocard_grid_figure_collection_v1"))[0].id, "yachta");
  assert.equal(dom.window.name, "");
  dom.window.close();
});
