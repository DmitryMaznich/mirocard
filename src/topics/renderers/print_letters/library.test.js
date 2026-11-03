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

  it("ready notebooks: the four planned ones, every page fits its A4 sheet", () => {
    const ready = readyNotebooks(byId);
    expect(ready.map((r) => r.title)).toEqual([
      "Палочки и черточки", "Прямые линии 1: Г Т П Н", "Прямые линии 2: И Ш Е Ё", "Повторяем прямые линии",
    ]);
    for (const r of ready) for (const p of r.pages) expect(pageOverflows(p, r.format)).toBe(false);
    expect(ready[0].pages[0].blocks[0].size).toBe(4); // sticks and bars — large
    expect(ready[3].pages.every((p) => p.paper === "line")).toBe(true); // review — on ruled paper
  });
});
