import { describe, it, expect } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import PrintPageView from "@/handwriting/PrintPageView";
import { FOUR_LINE_PAPERS } from "@/handwriting/fourLinePapers";
import { layoutWideLinesIntoRows } from "@/handwriting/wordEngine";
import { getPathEndpoints } from "@/handwriting/pathGeometry";
import { buildPageTask, glyphMapOf } from "./pageTask.js";
import { languageView } from "./languages.js";
import { deckPapers } from "./model.js";

// The Slovenian language of «Прописи: латиница» (docs/propis2-sl.md, step 2), a draft published in the deck since 0.10.0. Here it is laid over
// the published Latin deck the way scripts/build-propis2-deck.mjs does it (a style's letters from its `glyphsFile`).
const tc = JSON.parse(await readFile("tools/propis2/latin.json", "utf-8"));
const db = await openDb(`test-latin-sl-${Date.now()}`);
await importTopic(db, await readFile(`public/decks/propis2_lang_v${tc.version}.zip`), "999.0.0");
const published = await getTopicRecord(db, "propis2_lang");
const spec = JSON.parse(await readFile("tools/propis2/languages.json", "utf-8")).languages.find((l) => l.id === "sl");
const { deck: _deck, ...sl } = spec;
sl.styles = await Promise.all(sl.styles.map(async ({ glyphsFile, ...st }) => ({ ...st, glyphs: JSON.parse(await readFile(glyphsFile, "utf-8")).glyphs })));
const deck = { ...published, languages: [...published.languages.filter((l) => l.id !== "sl"), sl] };
const view = (style) => languageView(deck, "sl", style);
const page = (rec, lines, grid) => renderToStaticMarkup(<PrintPageView task={buildPageTask({ topicRecord: rec, lines, grid })} bare />);
const inkOf = (rec, text) => layoutWideLinesIntoRows([text], glyphMapOf(rec), undefined, false).placed[0];

describe("Slovenian (draft)", () => {
  it("is a draft of the Latin deck, published all the same (marked «черновик»: publishDraft, deck 0.10.0)", () => {
    expect(spec.status).toBe("draft");
    expect(spec.deck).toBe("latin");
    expect(spec.publishDraft).toBe(true);
    expect(published.languages.find((l) => l.id === "sl")?.status).toBe("draft");
  });

  it("25 letters, every one with a small and a capital form in both styles; the borrowed q w x y ć đ ä ö ü written too", () => {
    expect([...sl.alphabet.lower]).toHaveLength(25);
    for (const st of ["sl_caps", "sl_print"]) {
      const labels = new Set(view(st).wide.map((g) => g.label));
      for (const ch of sl.alphabet.lower) {
        expect(labels.has(ch), `${st} ${ch}`).toBe(true);
        expect(labels.has(ch.toUpperCase()), `${st} ${ch.toUpperCase()}`).toBe(true);
      }
      // the borrowed letters (step 4х): written when typed, not in the 25 of the alphabet
      for (const ch of "qwxyćđäöüQWXYĆĐÄÖÜ") expect(labels.has(ch), `${st} ${ch}`).toBe(true);
    }
  });

  it("the caron is the letter's last stroke, above the x-height (small) or the top line (capital)", () => {
    const glyphs = sl.styles[1].glyphs;
    for (const ch of "čšžČŠŽ") {
      const g = glyphs.find((x) => x.label === ch);
      expect(g.strokes.at(-1).name, ch).toBe("гачек");
      const base = glyphs.find((x) => x.label === ch.normalize("NFD")[0]);
      expect(g.strokes.slice(0, -1).map((s) => s.d)).toEqual(base.strokes.map((s) => s.d));
    }
  });

  it("small print letters the pen writes without lifting are one stroke (a b d g h m n p r u); A M N as the Slovene chart", async () => {
    const glyphs = sl.styles[1].glyphs;
    const strokes = (ch) => glyphs.find((g) => g.label === ch).strokes.length;
    for (const ch of "abdghmnpru") expect(strokes(ch), ch).toBe(1);
    expect([strokes("M"), strokes("N"), strokes("A")]).toEqual([1, 1, 3]);
    // the English print keeps its own strokes
    const en = JSON.parse(await readFile("tools/handwriting/latin/print_gb.json", "utf-8")).glyphs;
    expect(en.find((g) => g.label === "n").strokes).toHaveLength(2);
  });

  it("«Velike tiskane»: whatever is typed is written in capitals", () => {
    const caps = view("sl_caps");
    expect(caps.meta.script.caps).toBe(true);
    const typed = inkOf(caps, "mačka");
    const upper = inkOf(caps, "MAČKA");
    expect(JSON.stringify(typed)).toBe(JSON.stringify(upper));
    expect(JSON.stringify(inkOf(view("sl_print"), "mačka"))).not.toBe(JSON.stringify(upper));
  });

  it("cursive small letters (step 3): start on the baseline, end half-way up the x band — b o r v at the top; one movement each", () => {
    const glyphs = sl.styles.find((st) => st.id === "sl_cursive").glyphs;
    const pts = (d) => [...d.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    // the engine's capture frame (build-print.mjs): baseline y = 62, x-height 52
    const h = (y) => (62 - y) / 52;
    for (const ch of sl.alphabet.lower) {
      const g = glyphs.find((x) => x.label === ch);
      const p = pts(g.strokes[0].d);
      expect(h(p[0][1]), `${ch} starts on the baseline`).toBeCloseTo(0, 1);
      // the exit: where the last stroke that is not a dot / bar / caron ends (f: its own exit stroke)
      const last = g.strokes.filter((st) => !["точка", "черта", "гачек"].includes(st.name)).at(-1);
      const end = h(pts(last.d).at(-1)[1]);
      if ("bvor".includes(ch)) expect(end, `${ch} ends at the top`).toBeCloseTo(1, 1);
      else if (!"sš".includes(ch)) expect(end, `${ch} ends half-way up`).toBeCloseTo(0.48, 1);
      const lifts = g.strokes.slice(1).map((st) => st.name);
      const allowed = { i: ["точка"], j: ["точка"], t: ["черта"], f: ["выход"], o: ["крючок"], č: ["гачек"], š: ["гачек"], ž: ["гачек"] }[ch] ?? [];
      expect(lifts, ch).toEqual(allowed);
    }
  });

  it("cursive capitals (step 3): as tall as the ascenders, G and J down to the descender line; the carons last", () => {
    const glyphs = sl.styles.find((st) => st.id === "sl_cursive").glyphs;
    const ys = (g) => g.strokes.filter((st) => st.name !== "гачек").flatMap((st) => [...st.d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2])));
    const h = (y) => (62 - y) / 52; // capture frame: baseline 62, x-height 52
    for (const ch of sl.alphabet.lower.toUpperCase()) {
      const g = glyphs.find((x) => x.label === ch);
      expect(g.sourceLabel, ch).toBe(`slovene-${ch}`);
      const top = Math.max(...ys(g).map(h)), bottom = Math.min(...ys(g).map(h));
      expect(top, `${ch} top`).toBeGreaterThan(1.85);
      expect(top, `${ch} top`).toBeLessThan(2.12);
      if ("GJ".includes(ch)) expect(bottom, `${ch} descender`).toBeLessThan(-0.9);
      else expect(bottom, `${ch} on the baseline`).toBeGreaterThan(-0.15);
      if ("ČŠŽ".includes(ch)) expect(g.strokes.at(-1).name).toBe("гачек");
    }
  });

  it("joined words (step 4): the exit of a letter is the lead-in of the next; after B D F I N O P S Š T V the join leaves the capital's bottom", () => {
    const cur = view("sl_cursive");
    // the starts on the baseline: in a joined word only the first letter's lead-in starts there
    const baseStarts = (text) => {
      const all = [];
      const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { if (typeof o.d === "string") { if (!all.some((x) => x.d === o.d)) all.push(o); } else Object.values(o).forEach(walk); } };
      walk(inkOf(cur, text).segments);
      const starts = all.filter((st) => !st.join && !st.dashed).map((st) => getPathEndpoints(st.d).start[1]);
      return starts.filter((y) => y > 60).length; // the capture frame's baseline: y = 62
    };
    for (const w of ["ima", "mamin", "miza", "rumen", "trava", "lovi", "ovca", "vesel"]) expect(baseStarts(w), w).toBe(1);
    for (const w of ["Miha", "Lara", "Enea", "Janina", "Ana", "Urša"]) expect(baseStarts(w), w).toBe(0);
    // after the capitals that end on their left the join leaves the capital's bottom: no lead-in from the baseline either (IMENA sheet)
    for (const w of ["Da", "Ia", "Pa", "Ta", "Bor"]) expect(baseStarts(w), w).toBe(0);
  });

  it("the word list (tools/propis2/sl-words.json): every word written joined, capitals included", async () => {
    const cur = view("sl_cursive");
    const list = JSON.parse(await readFile("tools/propis2/sl-words.json", "utf-8")).groups;
    const baseStarts = (text) => {
      const all = [];
      const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { if (typeof o.d === "string") { if (!all.some((x) => x.d === o.d)) all.push(o); } else Object.values(o).forEach(walk); } };
      walk(inkOf(cur, text).segments);
      return all.filter((st) => !st.join && !st.dashed).map((st) => getPathEndpoints(st.d).start[1]).filter((y) => y > 60).length;
    };
    for (const g of list) for (const w of g.words) {
      const want = g.id.startsWith("caps") ? 0 : 1;
      expect(baseStarts(w), `${g.id}: ${w}`).toBe(want);
    }
    if (process.env.SL_SHOTS) {
      for (const g of list) {
        const lines = [];
        for (let i = 0; i < g.words.length; i += 2) lines.push(`${g.words.slice(i, i + 2).join(" ")}#1`);
        await writeFile(`${process.env.SL_SHOTS}/list-${g.id}.html`, `<!doctype html><meta charset="utf-8"><style>svg{background:#fff}</style><body style="margin:0;background:#fff">${page(cur, lines, "sl_6")}</body>`);
      }
    }
  });

  it("the Slovene paper: three solid lines, equal bands, two bands blank between rows («Za začetek» p. 55); four sizes", async () => {
    for (const id of ["sl", "sl_10", "sl_8", "sl_6", "sl_45"]) {
      const p = FOUR_LINE_PAPERS[id];
      expect(p.upMm, id).toBeCloseTo(p.xMm, 9);
      expect(p.downMm + p.gapMm, id).toBeCloseTo(2 * p.xMm, 9);
      expect(p.lines.bottom).toBe("none");
      expect(p.lines.x).toBe("thin");
    }
    expect(deckPapers(view("sl_print")).map((p) => p.id)).toEqual(["sl_10", "sl_8", "sl_6", "sl", "square", "ruled"]); // (4.5 mm out of the choice, owner 2026-11-14; the paper stays for notebooks made on it)
    const html = page(view("sl_print"), ["mama", "Čaša in šivanka"], "sl_8");
    const ruling = html.match(/<g data-simple-grid="sl_8">([\s\S]*)/)[1];
    expect(ruling).toMatch(/data-bg-row="0"/);
    if (process.env.SL_SHOTS) {
      const out = process.env.SL_SHOTS;
      for (const [name, style, lines, grid] of [
        ["caps", "sl_caps", ["A", "M#r", "N", "mama ata", "Čaša žaba šola"], "sl_10"],
        ["print", "sl_print", ["a", "n#r", "abcčdefghijklmnoprsštuvzž", "Čaša in šivanka", "Žaba skače v vodo."], "sl_8"],
        ["cursive1", "sl_cursive", ["a b c č d e f", "g h i j k l m", "n o p r s š t", "u v z ž"], "sl_10"],
        ["cursive2", "sl_cursive", ["a#r", "e#r", "l#r", "o#r"], "sl_8"],
        ["capitals", "sl_cursive", ["A B C Č D E F", "G H I J K L M", "N O P R S Š T", "U V Z Ž"], "sl_10"],
        ["names", "sl_cursive", ["Miha David", "Enea Lara", "Izak Janina"], "sl_10"],
        ["words1", "sl_cursive", ["ima imata", "rumen zelen", "mamin trava"], "sl_10"],
        ["cmp", "sl_cursive", ["rumen", "mamin", "ovca", "muca"], "sl_10"],
        ["vire", "sl_cursive", ["Vid Vika#1", "reka drevo#1", "Jure brest#1", "vi ve#1"], "sl_10"],
        ["rwords", "sl_cursive", ["r ra re#1", "trava rumen#1", "krava prst#1", "riba Peter#1"], "sl_10"],
        ["ejoin", "sl_cursive", ["me ne ze#1", "le te he#1", "trava vrata#1", "zelen vesel#1"], "sl_10"],
        ["rsheet", "sl_cursive", ["nabral žafrane#1", "frizerjev raste#1", "Andrej igrati#1", "fotografiji re#1"], "sl_10"],
        ["brjoin", "sl_cursive", ["br vr or rr#1", "nabral obrok#1", "brat zebra#1", "dvor ovratnik#1"], "sl_10"],
        ["sjoin", "sl_cursive", ["sa se si so#1", "raste pisane#1", "sestra osa#1", "lisica sliva#1"], "sl_10"],
        ["capoval", "sl_cursive", ["Lara Žan#1", "Tanja David#1", "Jakob Janina#1", "Mark Adela Oto#1"], "sl_10"],
        ["tope", "sl_cursive", ["re ve oe be#1", "reže vesel#1", "drevo obleka#1", "svetel breg#1"], "sl_10"],
        ["sej", "sl_cursive", ["ce če ke#1", "cesta čevelj#1", "srce lisice#1", "se jelka ge#1"], "sl_10"],
        ["straight", "sl_cursive", ["le ie mi#1", "lina kino#1", "oa ra kolo#1", "noga voda#1"], "sl_10"],
        ["topexit", "sl_cursive", ["perica ri ra#1", "trava vrata#1", "dobro oblak#1", "kolo voda#1"], "sl_10"],
        ["capsfoot", "sl_cursive", ["Izak David#1", "Primož Bor#1", "Tanja Nina#1", "Filip Sara#1"], "sl_10"],
        ["capi", "sl_cursive", ["Mi Ma Mu Mn#1", "Ai Ei Ui Ji#1", "Li Le La Lu#1", "Ži Ži Ku Hi#1"], "sl_10"],
        ["cape", "sl_cursive", ["Le Me Ae Ue#1", "Je Že Ke He#1", "Lea Leja Lena#1", "Meta Eva Uroš#1"], "sl_10"],
        ["capfa", "sl_cursive", ["Ia Da Ja Ta#1", "Pa Ba Fa Na#1", "Oa Sa Va Šo#1", "Ida Dora Jana Tadej#1"], "sl_10"],
        ["borrowed", "sl_cursive", ["q w x y#1", "ć đ ä ö ü#1", "Q W X Y#1", "Ć Đ Ä Ö Ü#1", "Xaver Yvonne#1", "Đurđa Ćiril#1", "Wolf Quinn#1", "Jürgen Ötzi#1", "Äsa Üna Ćevapi#1", "taxi yoga quiz#1"], "sl_10"],
        ["borrowedp", "sl_print", ["q w x y ć đ ä ö ü#1", "Q W X Y Ć Đ#1", "Ä Ö Ü#1", "Xaver Đurđa#1", "Jürgen Ötzi#1"], "sl_10"],
        ["ij", "sl_cursive", ["I J Z#1", "Izak Janina#1", "Ida Jure Zala#1"], "sl_10"],
        ["fjoin", "sl_cursive", ["fi ti li#1", "fa ta fe te#1", "fr tr fu tu#1", "film fant lift#1"], "sl_10"],
        ["lea", "sl_cursive", ["Le La#1", "Leja Lara#1", "le la#1", "Lea Luka#1"], "sl_10"],
        ["words2", "sl_cursive", ["nov lovi", "ovca vesel", "svetel naš"], "sl_10"],
      ]) await writeFile(`${out}/${name}.html`, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff">${page(view(style), lines, grid)}</body>`);
    }
  });
});
