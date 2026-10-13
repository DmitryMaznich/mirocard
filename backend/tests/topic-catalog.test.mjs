import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { initDb } from "../lib/db.mjs";
import {
  applyCatalogOverrides,
  topicRegistry,
  updateTopicCatalog,
} from "../lib/topic-catalog.mjs";
const fixture = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "topic-catalog-"));
  writeFileSync(path.join(dir, "alpha.zip"), "package");
  writeFileSync(path.join(dir, "draft.zip"), "package");
  const base = {
    decks: [
      {
        id: "alpha",
        title: { ru: "Тема" },
        version: "1.0.0",
        status: "hidden",
        hidden: true,
        access: "paid",
        url: "./decks/alpha.zip",
      },
    ],
  };
  const inventory = [
    {
      id: "alpha",
      title: "Тема",
      version: "1.1.0",
      sources: ["tools/alpha/topic.json"],
      sourceUpdatedAt: "2026-10-01",
    },
    {
      id: "draft",
      version: "0.1.0",
      title: "Черновик",
      bundle: { title: "Черновик", version: "0.1.0", url: "./decks/draft.zip" },
    },
    {
      id: "unfinished",
      title: "Нет пакета",
      sources: ["content/unfinished/topic.json"],
    },
    { id: "builtin", title: "Встроена", builtin: true },
  ];
  return { dir, base, inventory, db: initDb(":memory:") };
};
const patch = (extra = {}) => ({
  listed: true,
  status: "release",
  access: "free",
  expectedRevision: 0,
  ...extra,
});
test("flags override contradictory hidden base; removal is reversible and preserves new deploy versions", () => {
  const { db, base, dir, inventory } = fixture();
  const changed = updateTopicCatalog(
    db,
    base,
    dir,
    "alpha",
    patch(),
    inventory,
  ).topic;
  assert.equal(changed.publication, "release");
  assert.equal(changed.hidden, false);
  assert.equal(changed.catalogVersion, "1.0.0");
  assert.equal(changed.sourceVersion, "1.1.0");
  const effective = applyCatalogOverrides(db, base, inventory).decks[0];
  assert.equal(effective.access, "free");
  assert.equal(effective.hidden, false);
  assert.throws(
    () => updateTopicCatalog(db, base, dir, "alpha", patch(), inventory),
    (e) => e.status === 409,
  );
  updateTopicCatalog(
    db,
    base,
    dir,
    "alpha",
    patch({ listed: false, expectedRevision: 1 }),
    inventory,
  );
  assert.equal(applyCatalogOverrides(db, base, inventory).decks.length, 0);
  assert.equal(
    topicRegistry(db, base, dir, inventory).find((t) => t.id === "alpha")
      .publication,
    "removed",
  );
  base.decks[0].version = "2.0.0";
  updateTopicCatalog(
    db,
    base,
    dir,
    "alpha",
    patch({ expectedRevision: 2 }),
    inventory,
  );
  assert.equal(
    applyCatalogOverrides(db, base, inventory).decks[0].version,
    "2.0.0",
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM admin_topic_events").get().n,
    3,
  );
  db.close();
});
test("ready uncatalogued package can be added, unfinished and built-in topics cannot be fabricated as catalog packages", () => {
  const { db, base, dir, inventory } = fixture();
  assert.equal(topicRegistry(db, base, dir, inventory).length, 4);
  updateTopicCatalog(
    db,
    base,
    dir,
    "draft",
    patch({ status: "beta", access: "paid" }),
    inventory,
  );
  assert.equal(
    applyCatalogOverrides(db, base, inventory).decks.find(
      (t) => t.id === "draft",
    ).url,
    "./decks/draft.zip",
  );
  for (const id of ["unfinished"])
    assert.throws(
      () => updateTopicCatalog(db, base, dir, id, patch(), inventory),
      (e) => e.status === 409,
    );
  assert.throws(
    () =>
      updateTopicCatalog(
        db,
        base,
        dir,
        "alpha",
        patch({ access: "unknown" }),
        inventory,
      ),
    (e) => e.status === 400,
  );
  db.close();
});
test("manual controls survive reopening the persistent database", () => {
  const { db, base, dir, inventory } = fixture();
  db.close();
  const file = path.join(dir, "database.sqlite");
  let persisted = initDb(file);
  updateTopicCatalog(
    persisted,
    base,
    dir,
    "alpha",
    patch({ listed: false }),
    inventory,
  );
  persisted.close();
  persisted = initDb(file);
  assert.equal(
    applyCatalogOverrides(persisted, base, inventory).decks.length,
    0,
  );
  assert.equal(
    topicRegistry(persisted, base, dir, inventory).find((t) => t.id === "alpha")
      .overrideRevision,
    1,
  );
  persisted.close();
});


test("builtin visibility affects bootstrap policy without creating catalog entries or deleting data",async()=>{
  const {getBuiltinVisibility}=await import("../lib/topic-catalog.mjs");const {db,base,dir,inventory}=fixture();
  updateTopicCatalog(db,base,dir,"builtin",patch({status:"hidden",access:"free"}),inventory);
  assert.equal(getBuiltinVisibility(db,inventory).builtin,false);
  assert.equal(topicRegistry(db,base,dir,inventory).find(t=>t.id==="builtin").publication,"builtin_hidden");
  assert.equal(applyCatalogOverrides(db,base,inventory).decks.length,1);
  updateTopicCatalog(db,base,dir,"builtin",patch({status:"release",access:"free",expectedRevision:1}),inventory);
  assert.equal(getBuiltinVisibility(db,inventory).builtin,true);db.close();
});
