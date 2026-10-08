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

  it("the three designs of the first version are presets of the template", () => {
    for (const p of PRESETS) expect(presetOf(applyPreset(defaultCover(), p.id))).toBe(p.id);
    const propis = applyPreset(defaultCover(), "propis");
    expect(propis.title).toMatchObject({ style: "cursive", kicker: false });
    expect(propis.fields).toEqual(["name", "surname"]);
    expect(applyPreset(defaultCover(), "sample").decor).toBe("sample-window");
    expect(applyPreset(defaultCover(), "none").enabled).toBe(false);
  });

  it("a preset changes the front only: the name text, colour, logo and back stay", () => {
    const own = normalizeCover({ ...defaultCover(), title: { text: "Моя", style: "print", kicker: true }, accent: "gray", logo: false, back: { kind: "signs", paper: "square" } });
    const c = applyPreset(own, "propis");
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
    expect(presetOf(migrateLegacy("propis"))).toBe("propis");
    expect(presetOf(migrateLegacy("sample"))).toBe("sample");
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
  it("the alphabet: pairs, the lowercase alone where there is no capital, a blank row between rows", () => {
    const { heading, lines } = backContent("alphabet");
    expect(heading).toBe("Алфавит");
    const text = lines.filter(Boolean).join(" ");
    expect(text).toContain("А а _1 Б б");
    expect(text).not.toContain("Ё");
    expect(text).not.toContain("Й");
    expect(text).not.toMatch(/Ъ|Ы|Ь/);
    expect(lines.filter((l, i) => i % 2 === 1).every((l) => l === "")).toBe(true);
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
