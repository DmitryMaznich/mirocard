import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fourLinePaperIcon, IconPaperBg } from "./Propis2Icons.jsx";
import { fourLinePaper } from "@/handwriting/fourLinePapers.js";

// Owner, 2026-11-24: the British papers all had the Bulgarian icon, the Slovene ones differed only by how many rows fit — every paper
// of a language must be told apart at a glance: one row, its lines, the arrow and the lowercase height in mm (as the Russian rows).
const draw = (id) => renderToStaticMarkup(fourLinePaperIcon(id, fourLinePaper(id))());

describe("propis2: the icons of the three- and four-line papers", () => {
  for (const ids of [["sl_10", "sl_8", "sl_6", "sl"], ["en_gb_8", "en_gb_6", "en_gb", "en_gb_4"]]) {
    it(`${ids.join(", ")}: each its own icon, with its size in mm`, () => {
      const svgs = ids.map(draw);
      expect(new Set(svgs).size).toBe(ids.length);
      ids.forEach((id, i) => expect(svgs[i]).toContain(`>${String(fourLinePaper(id).xMm).replace(".", ",")}</text>`));
      for (const s of svgs) expect(s).not.toBe(renderToStaticMarkup(IconPaperBg()));
    });
  }

  it("the lines as the paper draws them: the British baseline dashed, the Slovene paper without a bottom line", () => {
    expect((draw("en_gb").match(/stroke-dasharray/g) ?? []).length).toBe(2);
    expect((draw("sl").match(/<path d="M2\.5 /g) ?? []).length).toBe(3);
  });
});
