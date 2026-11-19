// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BASELINE_PATH, scanUntranslatedLiterals } from "../../../scripts/untranslated-ui-literals.mjs";

// Interface text goes into the dictionaries (src/shared/i18n), never straight
// into a screen: otherwise it cannot be translated (owner, 2026-11-19). The
// Russian strings already in the code are the baseline; a file may only lose
// them. See scripts/untranslated-ui-literals.mjs.
describe("interface text lives in the dictionaries", () => {
  it("no file has more Russian strings in its code than its baseline", () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
    const grown = Object.entries(scanUntranslatedLiterals())
      .filter(([file, n]) => n > (baseline[file] ?? 0))
      .map(([file, n]) => `${file}: ${n} (baseline ${baseline[file] ?? 0}) — move the new text into src/shared/i18n`);
    expect(grown).toEqual([]);
  });
});
