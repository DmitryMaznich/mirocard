import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withTransaction } from "./db.mjs";
const inventoryPath = fileURLToPath(
  new URL("../generated/topic-inventory.json", import.meta.url),
);
export function readTopicInventory() {
  return existsSync(inventoryPath)
    ? JSON.parse(readFileSync(inventoryPath, "utf8")).topics
    : [];
}
const publication = (e) =>
  e?.hidden || e?.status === "hidden" ? "hidden" : (e?.status ?? "release");
function bundleEntry(row) {
  const b = row?.bundle;
  if (!b) return null;
  return {
    id: row.id,
    version: b.version,
    title: b.title,
    description:
      typeof b.description === "string"
        ? { ru: b.description }
        : (b.description ?? undefined),
    url: b.url,
    renderer: b.renderer,
    status: "hidden",
    access: "paid",
  };
}
export function applyCatalogOverrides(
  db,
  base,
  inventory = readTopicInventory(),
) {
  const entries = new Map((base.decks ?? []).map((e) => [e.id, { ...e }]));
  for (const row of db.prepare("SELECT * FROM topic_catalog_overrides").all()) {
    if (inventory.some((t) => t.id === row.topic_id && t.builtin)) continue;
    const patch = JSON.parse(row.settings_json);
    if (patch.listed === false) {
      entries.delete(row.topic_id);
      continue;
    }
    const original =
      entries.get(row.topic_id) ??
      bundleEntry(inventory.find((t) => t.id === row.topic_id));
    if (!original) continue;
    entries.set(row.topic_id, {
      ...original,
      status: patch.status,
      hidden: patch.status === "hidden",
      access: patch.access,
    });
  }
  return { ...base, decks: [...entries.values()] };
}
export function topicRegistry(
  db,
  base,
  decksDir,
  inventory = readTopicInventory(),
) {
  const effective = applyCatalogOverrides(db, base, inventory).decks;
  const ids = new Set([
    ...inventory.map((t) => t.id),
    ...(base.decks ?? []).map((t) => t.id),
    ...db
      .prepare("SELECT topic_id FROM topic_catalog_overrides")
      .all()
      .map((t) => t.topic_id),
  ]);
  return [...ids]
    .map((id) => {
      const source = inventory.find((t) => t.id === id) ?? {
        id,
        title: id,
        version: null,
        sources: [],
      };
      const original = (base.decks ?? []).find((t) => t.id === id),
        entry = effective.find((t) => t.id === id);
      const control = db
        .prepare("SELECT * FROM topic_catalog_overrides WHERE topic_id=?")
        .get(id);
      const settings = control ? JSON.parse(control.settings_json) : null;
      const builtinEnabled =
        !settings || (settings.listed && settings.status !== "hidden");
      const url =
        entry?.url ??
        entry?.zipUrl ??
        original?.url ??
        original?.zipUrl ??
        source.bundle?.url ??
        null;
      const zipFile = url ? path.join(decksDir, path.basename(url)) : null;
      const bundleAvailable = Boolean(zipFile && existsSync(zipFile));
      return {
        ...source,
        title: entry?.title ?? original?.title ?? source.title,
        catalogVersion: entry?.version ?? null,
        sourceVersion: source.version,
        inCatalog: Boolean(entry),
        removed: !source.builtin && settings?.listed === false,
        builtinEnabled: source.builtin ? builtinEnabled : null,
        publication: entry
          ? publication(entry)
          : source.builtin
            ? builtinEnabled
              ? "builtin"
              : "builtin_hidden"
            : settings?.listed === false
              ? "removed"
              : "draft",
        access: source.builtin
          ? "free"
          : (entry?.access ?? settings?.access ?? "paid"),
        hidden: source.builtin
          ? !builtinEnabled
          : entry
            ? publication(entry) === "hidden"
            : false,
        bundleAvailable,
        canManage:
          source.builtin || Boolean(original) || Boolean(source.bundle),
        overrideRevision: control?.revision ?? 0,
        adminUpdatedAt: control?.updated_at ?? null,
        sourceUpdatedAt: source.sourceUpdatedAt ?? null,
        reason: source.builtin
          ? builtinEnabled
            ? "Встроена в приложение и доступна пользователям"
            : "Встроенная тема скрыта администратором"
          : settings?.listed === false
            ? "Удалена администратором из каталога"
            : !entry
              ? bundleAvailable
                ? "ZIP готов, тема не включена в каталог"
                : "Есть разработка; опубликованного ZIP нет"
              : !bundleAvailable
                ? "Запись в каталоге есть, ZIP отсутствует"
                : null,
        settings: {
          listed: source.builtin ? builtinEnabled : Boolean(entry),
          status: source.builtin
            ? builtinEnabled
              ? "release"
              : "hidden"
            : entry
              ? publication(entry)
              : (settings?.status ?? "hidden"),
          access: source.builtin
            ? "free"
            : (entry?.access ?? settings?.access ?? "paid"),
        },
        history: db
          .prepare(
            "SELECT action,settings_json AS settings,created_at AS createdAt FROM admin_topic_events WHERE topic_id=? ORDER BY rowid DESC LIMIT 10",
          )
          .all(id),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}
export function updateTopicCatalog(
  db,
  base,
  decksDir,
  id,
  body,
  inventory = readTopicInventory(),
) {
  return withTransaction(db, () => {
    const topic = topicRegistry(db, base, decksDir, inventory).find(
      (t) => t.id === id,
    );
    if (!topic) throw { status: 404, message: "Тема не найдена." };
    if (!topic.canManage)
      throw {
        status: 409,
        message:
          "Для этой темы нет отдельного пакета каталога. Встроенные темы управляются кодом приложения.",
      };
    if (body.expectedRevision !== topic.overrideRevision)
      throw {
        status: 409,
        message: "Настройки изменились в другой вкладке. Обновите тему.",
      };
    if (
      typeof body.listed !== "boolean" ||
      !["release", "beta", "individual", "hidden"].includes(body.status) ||
      !["paid", "free"].includes(body.access)
    )
      throw { status: 400, message: "Некорректные флаги темы." };
    if (
      topic.builtin &&
      (!["release", "hidden"].includes(body.status) || body.access !== "free")
    )
      throw {
        status: 400,
        message:
          "Для встроенной темы доступны показ и скрытие, доступ бесплатный.",
      };
    if (
      !topic.builtin &&
      body.listed &&
      body.status !== "hidden" &&
      !topic.bundleAvailable
    )
      throw {
        status: 409,
        message: "Нельзя опубликовать тему: ZIP отсутствует.",
      };
    const settings = {
      listed: body.listed,
      status: body.status,
      access: body.access,
    };
    const now = new Date().toISOString(),
      revision = topic.overrideRevision + 1;
    db.prepare(
      "INSERT INTO topic_catalog_overrides VALUES (?,?,?,?) ON CONFLICT(topic_id) DO UPDATE SET settings_json=excluded.settings_json,revision=excluded.revision,updated_at=excluded.updated_at",
    ).run(id, JSON.stringify(settings), revision, now);
    db.prepare("INSERT INTO admin_topic_events VALUES (?,?,?,?,?)").run(
      randomUUID(),
      id,
      topic.builtin
        ? body.status === "hidden"
          ? "hide_builtin"
          : "show_builtin"
        : body.listed
          ? topic.inCatalog
            ? "update"
            : "restore"
          : "remove",
      JSON.stringify(settings),
      now,
    );
    return {
      ok: true,
      topic: topicRegistry(db, base, decksDir, inventory).find(
        (t) => t.id === id,
      ),
    };
  });
}

export function getBuiltinVisibility(db, inventory = readTopicInventory()) {
  const visibility = {};
  for (const t of inventory.filter((t) => t.builtin)) {
    const row = db
      .prepare(
        "SELECT settings_json FROM topic_catalog_overrides WHERE topic_id=?",
      )
      .get(t.id);
    if (row) {
      const settings = JSON.parse(row.settings_json);
      visibility[t.id] = Boolean(
        settings.listed && settings.status !== "hidden",
      );
    }
  }
  return visibility;
}
