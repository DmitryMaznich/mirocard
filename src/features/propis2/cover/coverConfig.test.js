import { describe, it, expect } from "vitest";
import { PRESETS, applyPreset, defaultCover, migrateLegacy, normalizeCover, presetOf, coverTitle } from "./coverConfig.js";
import { backContent } from "./backContent.js";

describe("cover config", () => {
  it("defaults to the school preset with a back that suits the notebook", () => {
    const c = defaultCover();
    expect(presetOf(c)).toBe("school");
    expect(c.back).toEqual({ kind: "alphabet", paper: "copybook" });
    expect(defaultCover({ squared: true }).back).toEqual({ kind: "digits", paper: "square" });
  });

  it("the designs of the first version are presets of the template («С образцом» dropped 2026-10-14)", () => {
    for (const p of PRESETS) expect(presetOf(applyPreset(defaultCover(), p.id))).toBe(p.id);
    expect(PRESETS.map((p) => p.id)).toEqual(["none", "school"]); // «С образцом» and «Пропись» dropped 2026-10-14
    expect(applyPreset(defaultCover(), "none").enabled).toBe(false);
  });

  it("a preset changes the front only: the name text, colour, logo and back stay", () => {
    const own = normalizeCover({ ...defaultCover(), title: { text: "Моя", style: "print", kicker: true }, accent: "gray", logo: false, back: { kind: "signs", paper: "square" } });
    const c = applyPreset({ ...own, decor: "frame", fields: ["name"] }, "school");
    expect(c.title.text).toBe("Моя");
    expect(c.accent).toBe("gray");
    expect(c.logo).toBe(false);
    expect(c.back).toEqual({ kind: "signs", paper: "square" });
  });

  it("a cover of its own is no preset", () => {
    expect(presetOf({ ...defaultCover(), decor: "frame" })).toBeNull();
    expect(presetOf({ ...defaultCover(), fields: ["name"] })).toBeNull();
  });

  it("migrates the designs the first version kept on the device", () => {
    expect(presetOf(migrateLegacy("school"))).toBe("school");
    expect(presetOf(migrateLegacy("propis"))).toBe("school"); // the name in our hand was dropped
    expect(normalizeCover({ ...defaultCover(), title: { style: "cursive", kicker: false } }).title.style).toBe("print");
    expect(presetOf(migrateLegacy("sample"))).toBe("school"); // the window was dropped
    expect(normalizeCover({ ...defaultCover(), decor: "sample-window" }).decor).toBe("none");
    expect(migrateLegacy("none").enabled).toBe(false);
    expect(presetOf(migrateLegacy(undefined))).toBe("school");
    expect(migrateLegacy("sample", { squared: true }).back.kind).toBe("digits");
  });

  it("validates: unknown values fall back, fields keep their order without repeats", () => {
    const c = normalizeCover({ enabled: true, title: { text: "  ", style: "gothic" }, decor: "stars", fields: ["started", "name", "name", "x"], accent: "pink", back: { kind: "map", paper: "dots" } });
    expect(c.title).toEqual({ text: null, style: "print", kicker: true });
    expect(c.decor).toBe("none");
    expect(c.fields).toEqual(["name", "started"]);
    expect(c.accent).toBe("teal");
    expect(c.back).toEqual({ kind: "alphabet", paper: "copybook" });
    expect(normalizeCover(null)).toEqual(defaultCover());
    expect(normalizeCover({ back: { kind: "digits" } }).back.paper).toBe("square");
    // a normalized cover is a fixed point (it is what is stored in the notebook)
    expect(normalizeCover(c)).toEqual(c);
  });

  it("the name on the cover: the cover's own text, else the notebook's", () => {
    expect(coverTitle(defaultCover(), "Цифры")).toBe("Цифры");
    expect(coverTitle({ title: { text: "Своё" } }, "Цифры")).toBe("Своё");
    expect(coverTitle(defaultCover(), "")).toBe("Тетрадь");
  });
});

describe("back content", () => {
  it("the alphabet: pairs, the lowercase alone where there is no capital, row after row", () => {
    const { heading, lines } = backContent("alphabet");
    expect(heading).toBe("Алфавит");
    const text = lines.filter(Boolean).join(" ");
    expect(text).toContain("А а _1 Б б");
    expect(text).not.toContain("Ё");
    expect(text).not.toContain("Й");
    expect(text).not.toMatch(/Ъ|Ы|Ь/);
    expect(lines.every(Boolean)).toBe(true);
  });

  it("digits and signs are glyph labels", () => {
    expect(backContent("digits").lines[0]).toMatch(/^№0 №1 №2/);
    expect(backContent("signs").lines[0]).toContain("№+");
    expect(backContent("none")).toBeNull();
  });

  it("fits one page: 17 rows of the narrow ruling, 20 squares", () => {
    for (const k of ["alphabet", "punctuation"]) expect(backContent(k).rows).toBeLessThanOrEqual(15);
    for (const k of ["digits", "signs", "digits-signs"]) expect(backContent(k).rows).toBeLessThanOrEqual(18);
  });
});
