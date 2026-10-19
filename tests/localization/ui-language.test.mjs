import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import { createUiLanguageController, UI_LANGUAGE_STORAGE_KEY, isUiLanguage, translateUiMessage } from "../../src/shared/i18n/uiLanguage.js";
import { UI_MESSAGES } from "../../src/shared/i18n/messages.js";

function memoryStorage(value) {
  const values = new Map(value === undefined ? [] : [[UI_LANGUAGE_STORAGE_KEY, value]]);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, next) => values.set(key, next) };
}

test("both dictionaries contain every prototype message and the same placeholders", () => {
  assert.deepEqual(Object.keys(UI_MESSAGES.sl).sort(), Object.keys(UI_MESSAGES.ru).sort());
  for (const key of Object.keys(UI_MESSAGES.ru)) {
    assert.ok(UI_MESSAGES.sl[key].trim(), key);
    const variables = (value) => [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
    assert.deepEqual(variables(UI_MESSAGES.sl[key]), variables(UI_MESSAGES.ru[key]), key);
  }
  assert.equal(isUiLanguage("en"), false);
  assert.equal(isUiLanguage("sl-SI"), false);
  assert.equal(translateUiMessage("sl", "settings.zoneIcon", { icon: "📦" }), "Ikona mesta shranjevanja: 📦");
});

test("selection survives reload and sets the document language immediately", () => {
  const storage = memoryStorage();
  const root = {};
  const first = createUiLanguageController({ storage, root });
  assert.equal(root.lang, "ru");
  first.setLanguage("sl");
  assert.equal(root.lang, "sl");
  const nextRoot = {};
  const reloaded = createUiLanguageController({ storage, root: nextRoot });
  assert.equal(reloaded.getSnapshot().language, "sl");
  assert.equal(nextRoot.lang, "sl");
});

test("a manual choice wins over late and repeated IDB/server hydration", () => {
  const controller = createUiLanguageController({ storage: memoryStorage() });
  controller.hydrate("ru");
  controller.setLanguage("sl");
  assert.equal(controller.hydrate("ru"), false);
  assert.equal(controller.getSnapshot().language, "sl");
  controller.setLanguage("ru");
  assert.equal(controller.hydrate("sl"), false);
  assert.equal(controller.getSnapshot().language, "ru");
});

test("legacy supported settings seed an unset preference; invalid values never activate", () => {
  for (const invalid of [null, "en", "sl-SI", "<script>", "", "SL"]) {
    const controller = createUiLanguageController({ storage: memoryStorage(invalid) });
    assert.equal(controller.getSnapshot().language, "ru");
    const before = controller.getSnapshot();
    assert.equal(controller.setLanguage(invalid), false);
    assert.equal(controller.getSnapshot(), before);
  }
  const controller = createUiLanguageController({ storage: memoryStorage() });
  controller.hydrate("sl");
  assert.equal(controller.getSnapshot().language, "sl");
});

test("blocked storage still allows switching and protects it from bootstrap", () => {
  const storage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); } };
  const root = {};
  const controller = createUiLanguageController({ storage, root });
  controller.setLanguage("sl");
  assert.deepEqual(controller.getSnapshot(), { language: "sl", saved: false });
  assert.equal(root.lang, "sl");
  controller.hydrate("ru");
  assert.equal(controller.getSnapshot().language, "sl");
});

test("subscription snapshots are stable and unmounting detaches the listener", () => {
  const controller = createUiLanguageController({ storage: memoryStorage("ru") });
  let calls = 0;
  const unsubscribe = controller.subscribe(() => calls++);
  const before = controller.getSnapshot();
  controller.setLanguage("ru");
  assert.equal(controller.getSnapshot(), before);
  controller.setLanguage("sl");
  assert.equal(calls, 1);
  unsubscribe();
  controller.setLanguage("ru");
  assert.equal(calls, 1);
});

test("pre-React HTML bootstrap uses the same key and validation, including blocked storage", async () => {
  const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
  const script = html.match(/<script id="ui-language-boot">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  for (const [saved, expected] of [["sl", "sl"], ["ru", "ru"], ["en", "ru"], [null, "ru"]]) {
    const context = { document: { documentElement: { lang: "ru" } }, localStorage: memoryStorage(saved) };
    vm.runInNewContext(script, context);
    assert.equal(context.document.documentElement.lang, expected);
  }
  const context = { document: { documentElement: { lang: "ru" } }, get localStorage() { throw new Error("blocked"); } };
  assert.doesNotThrow(() => vm.runInNewContext(script, context));
});

test("Slovenian counts use CLDR dual and few forms, Russian keeps its own rules", () => {
  const counts = [0, 1, 2, 3, 4, 5, 11, 12, 101, 102];
  const sl = ["video nagrad", "video nagrada", "video nagradi", "video nagrade", "video nagrade", "video nagrad", "video nagrad", "video nagrad", "video nagrada", "video nagradi"];
  const ru = ["видео-наград", "видео-награда", "видео-награды", "видео-награды", "видео-награды", "видео-наград", "видео-наград", "видео-наград", "видео-награда", "видео-награды"];
  counts.forEach((count, i) => {
    assert.equal(translateUiMessage("sl", "students.videoCount", { count }), `${count} ${sl[i]}`);
    assert.equal(translateUiMessage("ru", "students.videoCount", { count }), `${count} ${ru[i]}`);
  });
  assert.equal(translateUiMessage("sl", "students.videoCount", { count: 1.5 }), "1.5 video nagrade");
});

test("setup metadata translation preserves keys, unknown content and explicit Slovenian labels", async () => {
  const { setupText, setupLabels, setupInfo } = await import("../../src/shared/i18n/setupText.js");
  const { setUiLanguage } = await import("../../src/shared/i18n/uiLanguage.js");
  const definition = Object.freeze({ ru: Object.freeze({ upper: "Заглавную по строчной", custom: "Мой новый текст" }) });
  try {
    setUiLanguage("sl");
    assert.deepEqual(setupLabels(definition), { upper: "Veliko po mali", custom: "Мой новый текст" });
    assert.equal(setupText({ ru: "Найди картинку", sl: "Lastno slovensko ime" }), "Lastno slovensko ime");
    assert.equal(setupText("Найди картинку"), "Poišči sliko");
    assert.deepEqual(setupInfo({ sl: { text: "Opis", tip: "Nasvet" } }), { text: "Opis", tip: "Nasvet" });
    assert.deepEqual(Object.keys(setupLabels(definition)), ["upper", "custom"]);
    setUiLanguage("ru");
    assert.deepEqual(setupLabels(definition), definition.ru);
  } finally { setUiLanguage("ru"); }
});
