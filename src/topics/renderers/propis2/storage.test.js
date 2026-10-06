import { describe, it, expect } from "vitest";
import { openDb } from "@/core/db";
import { applyLayout, emptyLibrary, loadLibrary, migrateToNotebooks, normalizeLibrary, presetsToNotebooks, removePage, removeSet, saveLibrary, upsertPage, upsertSet } from "./storage.js";
import { newPage, newRow, newSet } from "./model.js";

describe("propis2 library storage", () => {
  it("saves and reloads pages on the device, in order, surviving re-open", async () => {
    const db = await openDb("p2-" + Date.now() + Math.random());
    expect((await loadLibrary(db)).pages).toEqual([]);
    const a = newPage("A", { rows: [newRow({ text: "а" })] });
    const b = newPage("B", { rows: [newRow({ text: "б", mark: "d" })] });
    let lib = upsertPage(upsertPage(emptyLibrary(), a), b);
    await saveLibrary(lib, db);
    const back = await loadLibrary(db);
    expect(back.pages.map((p) => p.title)).toEqual(["B", "A"]);
    expect(back.pages[0].rows[0].mark).toBe("d");
    lib = removePage(back, a.id);
    await saveLibrary(lib, db);
    expect((await loadLibrary(db)).pages.map((p) => p.title)).toEqual(["B"]);
  });

  it("upsert replaces by id and stamps updatedAt; garbage in storage is tolerated", () => {
    const p = newPage("x");
    const lib = upsertPage(emptyLibrary(), p);
    const changed = upsertPage(lib, { ...p, title: "y" });
    expect(changed.pages).toHaveLength(1);
    expect(changed.pages[0].title).toBe("y");
    expect(normalizeLibrary({ pages: [null, { id: 1 }, { id: "ok", rows: [] }] }).pages).toHaveLength(1);
    expect(normalizeLibrary("junk").pages).toEqual([]);
  });

  it("stores sets, and deleting a page removes it from every set", async () => {
    const db = await openDb("p2s-" + Date.now() + Math.random());
    const a = newPage("A", { rows: [newRow({ text: "а" })] });
    const b = newPage("B", { rows: [newRow({ text: "б" })] });
    let lib = upsertPage(upsertPage(emptyLibrary(), a), b);
    const st = newSet("Комплект", { pageIds: [a.id, b.id, a.id] });
    lib = upsertSet(lib, st);
    await saveLibrary(lib, db);
    let back = await loadLibrary(db);
    expect(back.sets).toHaveLength(1);
    expect(back.sets[0].pageIds).toEqual([a.id, b.id, a.id]);
    back = removePage(back, a.id);
    expect(back.sets[0].pageIds).toEqual([b.id]);
    expect(removeSet(back, st.id).sets).toEqual([]);
    expect(normalizeLibrary({ sets: [null, { id: "x" }, { id: "ok", pageIds: [] }] }).sets).toHaveLength(1);
  });

  it("a page outside any notebook becomes a notebook of one page, the same on every device, once", () => {
    const loose = newPage("Буквы");
    let lib = upsertPage(emptyLibrary(), loose);
    const once = migrateToNotebooks(lib);
    expect(once.sets).toHaveLength(1);
    expect(once.sets[0]).toMatchObject({ id: `st_${loose.id}`, title: "Буквы", pageIds: [loose.id] });
    expect(migrateToNotebooks(once)).toBe(once); // nothing left to migrate
    // a notebook that was deleted stays deleted: its page is not wrapped again
    const gone = removeSet(once, `st_${loose.id}`);
    expect(gone.pages).toHaveLength(0);
  });

  it("deleting a notebook deletes the pages it owns, but not one that another notebook also lists", () => {
    const a = newPage("a"), b = newPage("b");
    let lib = upsertPage(upsertPage(emptyLibrary(), a), b);
    lib = upsertSet(lib, newSet("N1", { pageIds: [a.id, b.id] }));
    lib = upsertSet(lib, newSet("N2", { pageIds: [b.id] }));
    const n1 = lib.sets.find((st) => st.title === "N1");
    const next = removeSet(lib, n1.id);
    expect(next.pages.map((p) => p.id)).toEqual([b.id]);
    expect(next.deleted).toBeTruthy();
  });

  it("the paper of a notebook is set for all its pages and the notebook", () => {
    const a = newPage("a", { format: "a5" }), b = newPage("b", { format: "a5" });
    let lib = upsertPage(upsertPage(emptyLibrary(), a), b);
    lib = upsertSet(lib, newSet("N", { id: "st_n", pageIds: [a.id, b.id] }));
    const next = applyLayout(lib, "st_n", { format: "a4", ruling: "wide" });
    expect(next.pages.every((p) => p.format === "a4" && p.ruling === "wide")).toBe(true);
    expect(next.sets[0].ruling).toBe("wide");
    expect(applyLayout(lib, "st_n", {})).toBe(lib);
  });

  it("a saved template becomes a notebook of one page, the same everywhere, and is not rebuilt once deleted", () => {
    const ps = { id: "ps_1", title: "Мой лист", rows: [newRow({ text: "мама" })], createdAt: 5, updatedAt: 6 };
    let lib = { ...emptyLibrary(), presets: [ps] };
    const once = migrateToNotebooks(presetsToNotebooks(lib));
    expect(once.sets).toHaveLength(1);
    expect(once.sets[0]).toMatchObject({ id: "st_pg_ps_ps_1", title: "Мой лист" });
    expect(once.pages[0]).toMatchObject({ id: "pg_ps_ps_1", locked: false });
    expect(migrateToNotebooks(presetsToNotebooks(once))).toBe(once); // idempotent
    const gone = removeSet(once, "st_pg_ps_ps_1");
    expect(migrateToNotebooks(presetsToNotebooks(gone)).sets).toHaveLength(0);
  });
});
