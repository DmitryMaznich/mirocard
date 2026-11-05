import { describe, it, expect } from "vitest";
import topic from "../../../../tools/print_letters/topic.json";
import { missParts, missable, canMiss, missCopy, findSequence, findWidest, similarTo, describeTask } from "./tasks";
import { ladderRows } from "./model";
import { readyNotebooks, HIDDEN_PAIRS } from "./library";

const byId = Object.fromEntries(topic.cards.map((c) => [c.id, c]));

describe("print_letters row tasks", () => {
  it("«Допиши штрих» works on every letter; small strokes never go missing", () => {
    for (const c of topic.cards) {
      expect(canMiss(c), c.id).toBe(true);
      const names = missable(c).map((i) => missParts(c)[i].name);
      expect(names.some((n) => /точка|краткая|хвостик|ножка/.test(n)), c.id).toBe(false);
    }
  });

  it("cuts a one-stroke letter in halves: О left/right, С top/bottom", () => {
    expect(missParts(byId["О"])).toHaveLength(2);
    expect(missParts(byId["С"])).toHaveLength(2);
    expect(missParts(byId["С"])[0].d).toMatch(/^M 46,15 /);
    expect(missParts(byId["С"])[1].d).toMatch(/^M 0,50 /);
  });

  it("the missing stroke goes in turn, or stays the fixed one; the copy keeps the rest and the start", () => {
    const P = byId["П"];
    expect([0, 1, 2, 3].map((k) => missCopy(P, k).gone)).toEqual([0, 1, 2, 0]);
    const c = missCopy(P, 5, 2);
    expect(c.gone).toBe(2);
    expect(c.letter.strokes).toHaveLength(2);
    expect(c.start).toEqual([50, 0]);
  });

  it("«Найди и обведи»: about a third are the target, never side by side, stable for one seed", () => {
    const P = byId["П"];
    const seq = findSequence(P, 16, "row1", byId);
    expect(seq).toHaveLength(16);
    const hits = seq.map((l, i) => (l.id === "П" ? i : -1)).filter((i) => i >= 0);
    expect(hits.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < hits.length; i++) expect(hits[i] - hits[i - 1]).toBeGreaterThan(1);
    for (let i = 1; i < seq.length; i++) if (seq[i].id !== "П") expect(seq[i].id).not.toBe(seq[i - 1].id);
    expect(findSequence(P, 16, "row1", byId).map((l) => l.id)).toEqual(seq.map((l) => l.id));
    for (const c of topic.cards) expect(similarTo(c, byId).length, c.id).toBeGreaterThan(0);
    expect(findWidest(byId["Г"], byId).id).toBe("Т");
  });

  it("the ladder gets two «допиши штрих» rows after the fading contours", () => {
    const rows = ladderRows(byId["Н"]);
    const i = rows.findIndex((r) => r.task === "miss");
    expect(rows[i - 1].guide).toBe("fade");
    expect([rows[i].hint, rows[i + 1].hint]).toEqual(["dot", "none"]);
    expect(describeTask(rows[i])).toBe("допиши штрих · точка начала");
  });

  it("«Спрятанные буквы»: a short set of sheets, the missing stroke is the one the new letter adds", () => {
    const nb = readyNotebooks(byId).find((r) => r.id === "ready:hidden-letters");
    expect(nb.section).toBe("Задания");
    expect(nb.pages.length).toBeLessThanOrEqual(3);
    for (const p of HIDDEN_PAIRS) {
      const from = byId[p.from].strokes.map((s) => s.d.replace(/\s+/g, " "));
      const added = byId[p.to].strokes.filter((_, i) => i !== p.stroke).map((s) => s.d.replace(/\s+/g, " "));
      expect(added, `${p.from} → ${p.to}`).toEqual(expect.arrayContaining(from));
      expect(added).toHaveLength(from.length);
    }
  });
});
