import { describe, it, expect } from "vitest";
import topic from "../../../../tools/print_letters/topic.json";
import { pageOverflows } from "./model";
import {
  SYNC_PREFIX, copyNotebook, emptyLibrary, mergeRemote, newNotebook, notebookJson, putNotebook, readyNotebooks, removeNotebook,
} from "./library";

const byId = Object.fromEntries(topic.cards.map((c) => [c.id, c]));
const item = (nb) => ({ key: `${SYNC_PREFIX}${nb.id}`, value: nb });

describe("print_letters notebooks", () => {
  it("takes the newer version of each notebook from the account, keeps the newer local one", () => {
    const a = { ...newNotebook("A"), updatedAt: 100 };
    const b = { ...newNotebook("B"), updatedAt: 300 };
    const lib = putNotebook(putNotebook(emptyLibrary(), a), b);
    const remoteA = { ...a, title: "A с телефона", updatedAt: 200 };
    const remoteB = { ...b, title: "B старая", updatedAt: 250 };
    const { lib: merged, push } = mergeRemote(lib, [item(remoteA), item(remoteB)]);
    expect(merged.notebooks.find((n) => n.id === a.id).title).toBe("A с телефона");
    expect(merged.notebooks.find((n) => n.id === b.id).title).toBe("B");
    expect(push).toEqual([b.id]); // only B is newer here than on the account
  });

  it("brings in notebooks made on another device and sends up local ones the account lacks", () => {
    const local = { ...newNotebook("Здесь"), updatedAt: 50 };
    const remote = { ...newNotebook("Там"), updatedAt: 60 };
    const { lib, push } = mergeRemote(putNotebook(emptyLibrary(), local), [item(remote)]);
    expect(lib.notebooks.map((n) => n.title).sort()).toEqual(["Там", "Здесь"].sort());
    expect(push).toEqual([local.id]);
  });

  it("carries a delete to other devices, but an edit made after the delete wins", () => {
    const nb = { ...newNotebook("X"), updatedAt: 100 };
    const lib = putNotebook(emptyLibrary(), nb);
    const gone = mergeRemote(lib, [{ key: `${SYNC_PREFIX}${nb.id}`, value: { id: nb.id, deleted: true, updatedAt: 150 } }]);
    expect(gone.lib.notebooks).toEqual([]);
    expect(gone.lib.deleted[nb.id]).toBe(150);
    const edited = mergeRemote(putNotebook(emptyLibrary(), { ...nb, updatedAt: 200 }), [{ key: `${SYNC_PREFIX}${nb.id}`, value: { id: nb.id, deleted: true, updatedAt: 150 } }]);
    expect(edited.lib.notebooks).toHaveLength(1);
    // a local delete goes up as a tombstone
    expect(mergeRemote(removeNotebook(lib, nb.id, 300), []).push).toEqual([nb.id]);
  });

  it("copies a notebook with fresh ids all the way down", () => {
    const src = readyNotebooks(byId)[1];
    const cp = copyNotebook(src);
    expect(cp.id).not.toBe(src.id);
    expect(cp.ready).toBeUndefined();
    expect(cp.pages[0].id).not.toBe(src.pages[0].id);
    expect(cp.pages[0].blocks[0].rows[0].id).not.toBe(src.pages[0].blocks[0].rows[0].id);
    expect(notebookJson({ ...cp, updatedAt: 1 })).toBe(notebookJson({ ...cp, updatedAt: 2 }));
  });

  it("ready notebooks: the course after Ilyukhina — hand, lessons 2–16, a review per family; every page fits A4", () => {
    const ready = readyNotebooks(byId);
    expect(ready[0].title).toMatch(/^Подготовка руки/);
    const lessons = ready.filter((r) => r.id.startsWith("ready:lesson-"));
    expect(lessons.map((r) => r.title.split(":")[0])).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((n) => `Занятие ${n}`));
    expect(ready.filter((r) => r.id.startsWith("ready:review-")).map((r) => r.title)).toEqual(["Повторяем прямые линии", "Повторяем наклонные линии", "Повторяем овалы"]);
    for (const r of ready) for (const p of r.pages) expect(pageOverflows(p, r.format), `${r.title}`).toBe(false);
    // new letters on крупная клетка, one per page; the review on клетка; family reviews on линейка
    const l5 = ready.find((r) => r.id === "ready:lesson-5");
    expect(l5.pages.slice(0, 2).map((p) => [p.paper, p.blocks.length, p.blocks[0].letterId])).toEqual([["bigcell", 1, "Л"], ["bigcell", 1, "А"]]);
    expect(l5.pages.slice(2).every((p) => p.paper === "cell")).toBe(true);
    expect(ready.find((r) => r.id === "ready:review-oval").pages.every((p) => p.paper === "line")).toBe(true);
    // syllables and words only from letters learnt by that lesson
    const learnt = new Set();
    for (const r of lessons) {
      r.pages.filter((p) => p.paper === "bigcell").forEach((p) => p.blocks.forEach((b) => learnt.add(b.letterId)));
      for (const p of r.pages) for (const b of p.blocks) if (b.kind === "word") for (const w of b.words) for (const ch of w) expect(learnt.has(ch), `${r.title}: ${w}`).toBe(true);
    }
  });

  it("breaks pages automatically: a whole block moves on, a block taller than the sheet goes on as a continuation", async () => {
    const { reflowPages } = await import("./library");
    const { ladderRows: ladder, pageOverflows: over } = await import("./model");
    const L = (id) => byId[id];
    const blk = (id, n) => ({ id: `b-${id}-${n}`, letterId: id, color: "#000", size: 2, rows: Array.from({ length: n }, (_, i) => ({ id: `r-${id}-${i}`, ...ladder(L(id))[Math.min(i, 2)] })) });
    // three 8-row blocks on one A4 page: the third moves to a new page
    const pages = reflowPages([{ id: "p1", paper: "cell", blocks: [blk("Г", 8), blk("Т", 8), blk("П", 8)] }], "a4");
    expect(pages.map((p) => p.blocks.map((b) => b.letterId))).toEqual([["Г", "Т"], ["П"]]);
    expect(pages.every((p) => !over(p, "a4"))).toBe(true);
    // one 40-row block: split into a page-full and a continuation, row ids kept, same paper
    const long = reflowPages([{ id: "p1", paper: "bigcell", blocks: [blk("Н", 40)] }], "a4");
    expect(long.length).toBeGreaterThan(2);
    expect(long.every((p) => p.paper === "bigcell" && !over(p, "a4"))).toBe(true);
    expect(long.flatMap((p) => p.blocks.flatMap((b) => b.rows.map((r) => r.id)))).toEqual(Array.from({ length: 40 }, (_, i) => `r-Н-${i}`));
    // a page that fits is returned as is
    const ok = [{ id: "p1", paper: "cell", blocks: [blk("Г", 3)] }];
    expect(reflowPages(ok, "a4")).toBe(ok);
    // the next page has another paper: a new page goes in between
    const mixed = reflowPages([{ id: "p1", paper: "cell", blocks: [blk("Г", 8), blk("Т", 8), blk("П", 8)] }, { id: "p2", paper: "line", blocks: [] }], "a4");
    expect(mixed.map((p) => p.paper)).toEqual(["cell", "cell", "line"]);
  });
});
