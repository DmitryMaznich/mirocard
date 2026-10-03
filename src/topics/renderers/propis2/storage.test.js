import { describe, it, expect } from "vitest";
import { openDb } from "@/core/db";
import { emptyLibrary, loadLibrary, normalizeLibrary, removePage, saveLibrary, upsertPage } from "./storage.js";
import { newPage, newRow } from "./model.js";

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
});
