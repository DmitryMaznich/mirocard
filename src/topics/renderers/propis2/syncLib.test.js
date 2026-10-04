import { describe, it, expect } from "vitest";
import { diffOps, docKey, mergeRemote, parseKey, snapshotDocs, snapshotFromRemote } from "./syncLib.js";
import { emptyLibrary, removePage, removePreset, removeSet, upsertPage, upsertPreset, upsertSet } from "./storage.js";
import { newPage, newRow, newSet, presetFromPage } from "./model.js";

const remote = (lib) => [...snapshotDocs(lib)].map(([key, json]) => ({ key, value: JSON.parse(json) }));

describe("propis2 library sync", () => {
  it("keys are one per document", () => {
    expect(docKey("page", "pg_1")).toBe("propis2:page:pg_1");
    expect(parseKey("propis2:set:st_9")).toEqual({ kind: "set", id: "st_9" });
    expect(parseKey("propis2:library")).toBeNull();
  });

  it("diffOps sends only what changed, including deletions as tombstones", () => {
    const a = newPage("A");
    const b = newPage("B");
    let lib = upsertPage(upsertPage(emptyLibrary(), a), b);
    const first = diffOps(new Map(), lib);
    expect(first.ops.map((o) => o.key).sort()).toEqual([docKey("page", a.id), docKey("page", b.id)].sort());
    expect(diffOps(first.next, lib).ops).toEqual([]);
    lib = upsertPage(lib, { ...a, title: "A2" });
    const edit = diffOps(first.next, lib);
    expect(edit.ops).toHaveLength(1);
    expect(edit.ops[0].value.title).toBe("A2");
    lib = removePage(lib, b.id);
    const del = diffOps(edit.next, lib);
    expect(del.ops).toHaveLength(1);
    expect(del.ops[0]).toMatchObject({ key: docKey("page", b.id), value: { id: b.id, deleted: true } });
  });

  it("deleting a page also re-stamps the sets that listed it", () => {
    const a = newPage("A");
    let lib = upsertSet(upsertPage(emptyLibrary(), a), newSet("S", { pageIds: [a.id] }));
    const synced = snapshotDocs(lib);
    lib = removePage(lib, a.id);
    expect(diffOps(synced, lib).ops.map((o) => parseKey(o.key).kind).sort()).toEqual(["page", "set"]);
  });

  it("merge: remote documents appear locally, newer wins, older is ignored", () => {
    const p = { ...newPage("Remote"), updatedAt: 200 };
    const lib0 = emptyLibrary();
    const lib1 = mergeRemote(lib0, [{ key: docKey("page", p.id), value: p }]);
    expect(lib1.pages).toHaveLength(1);
    const newer = { ...p, title: "Remote 2", updatedAt: 300 };
    expect(mergeRemote(lib1, [{ key: docKey("page", p.id), value: newer }]).pages[0].title).toBe("Remote 2");
    const older = { ...p, title: "Old", updatedAt: 100 };
    expect(mergeRemote(lib1, [{ key: docKey("page", p.id), value: older }])).toBe(lib1);
    // not a valid page: ignored
    expect(mergeRemote(lib0, [{ key: docKey("page", "x"), value: { id: "x", updatedAt: 1 } }])).toBe(lib0);
  });

  it("merge: a newer tombstone removes the document, a newer local edit survives an older tombstone, no resurrection", () => {
    const p = { ...newPage("P"), updatedAt: 200 };
    const lib = { ...emptyLibrary(), pages: [p] };
    const key = docKey("page", p.id);
    const gone = mergeRemote(lib, [{ key, value: { id: p.id, deleted: true, updatedAt: 300 } }]);
    expect(gone.pages).toHaveLength(0);
    expect(gone.deleted[key]).toBe(300);
    expect(mergeRemote(gone, [{ key, value: p }])).toBe(gone); // an older copy does not come back
    const kept = mergeRemote(lib, [{ key, value: { id: p.id, deleted: true, updatedAt: 100 } }]);
    expect(kept.pages).toHaveLength(1);
  });

  it("two devices converge", () => {
    const page = { ...newPage("Shared"), updatedAt: 100, rows: [newRow({ text: "и" })] };
    const phone = upsertPage({ ...emptyLibrary() }, page);
    const tablet = mergeRemote(emptyLibrary(), remote(phone));
    expect(tablet.pages[0].id).toBe(page.id);
    const preset = presetFromPage(tablet.pages[0], "Мой");
    const tablet2 = upsertPreset(tablet, preset);
    const phone2 = mergeRemote(phone, remote(tablet2));
    expect(phone2.presets.map((x) => x.title)).toEqual(["Мой"]);
    const tablet3 = removePreset(tablet2, preset.id);
    const phone3 = mergeRemote(phone2, remote(tablet3));
    expect(phone3.presets).toHaveLength(0);
    expect(snapshotFromRemote(remote(tablet3)).size).toBe(snapshotDocs(tablet3).size);
    expect(removeSet(phone3, "none").deleted).toBeTruthy();
  });
});
