import { act } from "react";
import { createRoot } from "react-dom/client";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import JSZip from "jszip";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as dbModule from "@/core/db";
import { useAppStore } from "@/core/store";
import { setApiToken } from "@/core/api";
import { setUiLanguage } from "@/shared/i18n/uiLanguage.js";
import { createContentContext, selectedTopicLanguage } from "../../../shared/topic-language-contract.mjs";
import { sha256Bytes, remainingDownloadBytes, topicDownloadDescriptor } from "../../../shared/topic-delivery.mjs";
import { installTopicLanguage } from "./topicLanguageInstaller.js";
import { requestTopicLanguage } from "./topicLanguageChoice.js";
import TopicLanguageDialog from "./TopicLanguageDialog.jsx";
import { importTopicArchive } from "./topicArchiveImport.js";
import ParamsScreen from "@/features/session/ParamsScreen.jsx";
import { resolveModeSelection, buildGeneratedSessionState } from "@/features/session/useSessionEngine";

vi.mock("@/core/syncApi", () => ({ pushOp: vi.fn(), flushQueue: vi.fn() }));
vi.mock("@/features/timer/TimerContext", () => ({ useTimer: () => ({ markSessionStart: vi.fn() }) }));
const original = useAppStore.getState();
const catalog = JSON.parse(await readFile(resolve("public/decks/catalog.json"), "utf8"));
const entry = catalog.decks.find((e) => e.id === "comparison_language_pilot");
const coreBytes = await readFile(resolve("public", entry.url.slice(2)));
const archives = new Map([[entry.url.slice(1), coreBytes]]);
for (const part of Object.values(entry.languageDownload.languages)) archives.set(part.url.slice(1), await readFile(resolve("public", part.url.slice(2))));
let db, fetchMock, root, host;

beforeEach(async () => {
  db = await dbModule.openDb(`delivery-${Math.random()}`);
  vi.spyOn(dbModule, "getDb").mockResolvedValue(db);
  setApiToken(null); setUiLanguage("ru");
  useAppStore.setState({ ...original, screen: "topics", account: { id: "adult", email: "local" }, token: null,
    students: [{ id: "one", name: "Миша", preferredLessonLanguage: "sl" }, { id: "two", name: "Аня", preferredLessonLanguage: "ru" }],
    activeStudentId: "one", activeTopicId: entry.id, activeModeId: "compare_visual", topicRecords: [], studentTopicLinks: {}, sessions: [], ownedTopics: [],
    buildInfo: { version: "1.0.2676" }, settings: { ...original.settings, cardLanguage: "ru" }, topicLanguageRequest: null });
  fetchMock = vi.fn(async (url) => {
    const path = new URL(String(url), "https://example.test").pathname;
    const bytes = archives.get(path);
    if (!bytes) throw new Error(`Unexpected download ${path}`);
    return new Response(bytes, { headers: { "Content-Length": String(bytes.length) } });
  });
  vi.stubGlobal("fetch", fetchMock);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  await dbModule.kv.get(db, "installedTopicIds"); // drain outstanding IDB events
  db.close(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  setUiLanguage("ru"); useAppStore.setState(original, true);
});
const urls = () => fetchMock.mock.calls.map(([url]) => new URL(String(url), "https://example.test").pathname);
const findButton = (text) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(text));
async function submit() { await act(async () => findButton("Скачать")?.click()); }
async function settle(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await act(async () => new Promise((r) => setTimeout(r, 5)));
  }
  throw new Error("UI did not settle");
}

it("downloads only the selected language and reuses core and each cached package", async () => {
  const sl = await installTopicLanguage(entry, "sl", "1.0.2676");
  expect(urls()).toEqual([entry.url.slice(1), entry.languageDownload.languages.sl.url.slice(1)]);
  expect(Object.keys(sl.languageResources.content)).toEqual(["sl"]);
  expect(await dbModule.topics.getFile(db, entry.id, "content/ru.json")).toBeNull();
  expect(createContentContext(sl, sl.modes[0], { contentLanguage: "sl" }).contentLanguage).toBe("sl");
  expect(() => createContentContext(sl, sl.modes[0], { contentLanguage: "ru" })).toThrow();
  expect(remainingDownloadBytes(sl, entry.languageDownload, "ru")).toBe(entry.languageDownload.languages.ru.bytes);
  expect(await dbModule.kv.get(db, `topicCore:${entry.id}`)).not.toHaveProperty("buffer");
  fetchMock.mockClear();
  const both = await installTopicLanguage(entry, "ru", "1.0.2676");
  expect(urls()).toEqual([entry.languageDownload.languages.ru.url.slice(1)]);
  expect(Object.keys(both.languageResources.content).sort()).toEqual(["ru", "sl"]);
  expect(await dbModule.topics.getFile(db, entry.id, "content/sl.json")).not.toBeNull();
  fetchMock.mockClear();
  const offline = await installTopicLanguage(entry, "sl", "1.0.2676");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(remainingDownloadBytes(offline, entry.languageDownload, "sl")).toBe(0);
});

for (const ui of ["ru", "sl"]) {
  it(`${ui}: modal precedes any download and cancel changes nothing`, async () => {
    setUiLanguage(ui);
    let result;
    await act(async () => { result = requestTopicLanguage({ entry }); root.render(<TopicLanguageDialog />); });
    expect(host.querySelector('input[value="sl"]').checked).toBe(true);
    expect(host.textContent).toContain(ui === "ru" ? "Без речевой озвучки" : "Brez govornega zvoka");
    expect(host.textContent).toContain(ui === "ru" ? "3 режима" : "3 načini");
    expect(host.textContent).toContain(ui === "ru" ? "Озвучена подсказка после ошибки" : "Govorjeni namig po napaki");
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => findButton(ui === "ru" ? "Отмена" : "Prekliči").click());
    expect(await result).toBeNull();
    expect(await dbModule.kv.get(db, `topic:${entry.id}`)).toBeNull();
  });
}

it("one topic choice applies to both modes, remains student-specific and survives reload data", async () => {
  let result;
  await act(async () => { result = requestTopicLanguage({ entry }); root.render(<TopicLanguageDialog />); });
  await submit(); await settle(() => !useAppStore.getState().topicLanguageRequest);
  const record = await result;
  expect(record).not.toBeNull();
  const first = useAppStore.getState().studentTopicLinks[`one_${entry.id}`];
  expect(first.params.topicContentLanguage).toBe("sl");
  expect(useAppStore.getState().studentTopicLinks[`two_${entry.id}`]).toBeUndefined();
  expect((await dbModule.kv.get(db, "studentTopicLinks"))[`one_${entry.id}`].params.topicContentLanguage).toBe("sl");
  for (const mode of record.modes) {
    const selected = resolveModeSelection(record, mode, first, false, null);
    expect(selected.sessionParams.contentLanguage).toBe("sl");
    const session = buildGeneratedSessionState({ topicRecord: record, mode, link: first, activeStudentId: "one", activeTopicId: entry.id, ...selected });
    expect(session.languageContext.contentLanguage).toBe("sl");
  }
  setUiLanguage("sl");
  useAppStore.setState({ activeStudentId: "two", activeModeId: "compare_sign" });
  const secondBefore = resolveModeSelection(record, record.modes[1], {}, false, null);
  expect(secondBefore.sessionParams.contentLanguage).toBe("ru");
  expect(() => createContentContext(record, record.modes[1], secondBefore.sessionParams)).toThrow();
  await act(async () => { result = requestTopicLanguage({ entry, record }); });
  expect(host.querySelector('input[value="ru"]').checked).toBe(true);
  await act(async () => findButton("Prenesi").click());
  await settle(() => !useAppStore.getState().topicLanguageRequest);
  await result;
  expect(useAppStore.getState().studentTopicLinks[`one_${entry.id}`].params.topicContentLanguage).toBe("sl");
  expect(useAppStore.getState().studentTopicLinks[`two_${entry.id}`].params.topicContentLanguage).toBe("ru");
});

it("mode parameters no longer contain language controls after a topic is selected", async () => {
  const record = await installTopicLanguage(entry, "sl", "1.0.2676");
  useAppStore.setState({ topicRecords: [record], studentTopicLinks: { [`one_${entry.id}`]: { params: { topicContentLanguage: "sl" }, videoRewardEnabled: false } } });
  await act(async () => root.render(<ParamsScreen />));
  expect(host.textContent).not.toContain("Язык занятия");
  expect(findButton("Русский")).toBeUndefined();
  expect(findButton("Slovenščina")).toBeUndefined();
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

it("manual core import waits for selection and fetches only a language package", async () => {
  let promise;
  await act(async () => { promise = importTopicArchive(db, coreBytes, "1.0.2676"); root.render(<TopicLanguageDialog />); });
  await settle(() => Boolean(host.querySelector('input[value="sl"]')));
  expect(await dbModule.kv.get(db, `topic:${entry.id}`)).toBeNull();
  await submit(); await settle(() => !useAppStore.getState().topicLanguageRequest);
  const installed = await promise;
  expect(installed.meta.origin).toBe("imported");
  expect(urls()).toEqual([entry.languageDownload.languages.sl.url.slice(1)]);
});

it("damaged or interrupted downloads preserve the working topic, files and history", async () => {
  const installed = await installTopicLanguage(entry, "sl", "1.0.2676");
  const files = await dbModule.topics.listFiles(db, entry.id);
  const history = [{ id: "lesson", topicId: entry.id }];
  await dbModule.kv.set(db, "sessions", history);
  fetchMock.mockImplementationOnce(async () => new Response("broken"));
  await expect(installTopicLanguage(entry, "ru", "1.0.2676")).rejects.toThrow(/integrity/);
  expect(await dbModule.kv.get(db, `topic:${entry.id}`)).toEqual(installed);
  expect(await dbModule.topics.listFiles(db, entry.id)).toEqual(files);
  expect(await dbModule.kv.get(db, "sessions")).toEqual(history);
  fetchMock.mockImplementationOnce(async () => { throw new Error("offline"); });
  await expect(installTopicLanguage(entry, "ru", "1.0.2676")).rejects.toThrow(/offline/);
  expect(await dbModule.kv.get(db, `topic:${entry.id}`)).toEqual(installed);
});

it("a failed IndexedDB transaction rolls back record and files together", async () => {
  const before = await installTopicLanguage(entry, "sl", "1.0.2676");
  const files = await dbModule.topics.listFiles(db, entry.id);
  await expect(dbModule.topics.replaceTopic(db, entry.id, { invalid: { buf: () => {} } }, { meta: { id: entry.id, version: "broken" } })).rejects.toThrow();
  expect(await dbModule.kv.get(db, `topic:${entry.id}`)).toEqual(before);
  expect(await dbModule.topics.listFiles(db, entry.id)).toEqual(files);
});

it("refuses to commit a download after its account/student context changes", async () => {
  await expect(installTopicLanguage(entry, "sl", "1.0.2676", { ensureCurrent: () => { throw new Error("context changed"); } })).rejects.toThrow(/context changed/);
  expect(await dbModule.kv.get(db, `topic:${entry.id}`)).toBeNull();
});

it("conflicting legacy mode languages require one explicit topic choice", async () => {
  const source = JSON.parse(await readFile(resolve("tools/comparison_language_pilot/topic.json"), "utf8"));
  const params = { byMode: { compare_visual: { contentLanguage: "ru", level: 4 }, compare_sign: { contentLanguage: "sl", level: 2 } } };
  expect(selectedTopicLanguage(source, params, "ru")).toBeNull();
  expect(selectedTopicLanguage(source, { ...params, topicContentLanguage: "sl" }, "ru")).toBe("sl");
});

for (const kind of ["audio", "image"]) {
  it(`stores only the selected language's ${kind} assets`, async () => {
    const next = structuredClone(entry);
    const core = await JSZip.loadAsync(coreBytes);
    const manifest = JSON.parse(await core.file("topic.json").async("string"));
    const descriptor = manifest.languageContract.packages.sl;
    const languageZip = await JSZip.loadAsync(archives.get(descriptor.download.url.slice(1)));
    const pack = JSON.parse(await languageZip.file(descriptor.file).async("string"));
    const bytes = new TextEncoder().encode("slovensko gradivo");
    const path = `content/sl/${pack.version}/${kind === "audio" ? "voice.mp3" : "label.svg"}`;
    pack.assets = [{ path, kind, bytes: bytes.length, sha256: await sha256Bytes(bytes) }];
    pack.audio = descriptor.audio = kind === "audio" ? "recorded" : "none";
    languageZip.file(descriptor.file, JSON.stringify(pack)); languageZip.file(path, bytes);
    const languageBytes = await languageZip.generateAsync({ type: "uint8array" });
    descriptor.download.sha256 = await sha256Bytes(languageBytes); descriptor.download.bytes = languageBytes.length;
    next.languageDownload.languages.sl = { ...next.languageDownload.languages.sl, ...descriptor.download, audio: pack.audio };
    core.file("topic.json", JSON.stringify(manifest));
    const nextCore = await core.generateAsync({ type: "uint8array" });
    next.languageDownload.core.sha256 = await sha256Bytes(nextCore); next.languageDownload.core.bytes = nextCore.length;
    fetchMock.mockImplementation(async (url) => new Response(String(url).includes("/languages/") ? languageBytes : nextCore));
    const installed = await installTopicLanguage(next, "sl", "1.0.2676");
    expect(Object.keys(installed.languageResources.content)).toEqual(["sl"]);
    expect(await (await dbModule.topics.getFile(db, entry.id, path)).text()).toBe("slovensko gradivo");
    expect((await dbModule.topics.listFiles(db, entry.id)).some((name) => name.startsWith("content/ru"))).toBe(false);
  });
}


it("paid language downloads use the checked API for every part and never fall back to static files", async () => {
  const paid = { ...entry, access: "paid" };
  setApiToken("test-token");
  fetchMock.mockImplementation(async (url, options) => {
    const parsed = new URL(String(url), "https://example.test");
    expect(parsed.pathname).toBe(`/api/decks/${entry.id}/download`);
    expect(options.headers.Authorization).toBe("Bearer test-token");
    const part = parsed.searchParams.get("part") === "core" ? entry.languageDownload.core : entry.languageDownload.languages[parsed.searchParams.get("language")];
    return new Response(archives.get(part.url.slice(1)));
  });
  const installed = await installTopicLanguage(paid, "sl", "1.0.2676");
  expect(installed.installation.access).toBe("paid");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  fetchMock.mockClear();
  fetchMock.mockResolvedValueOnce(new Response("Forbidden", { status: 403 }));
  await expect(installTopicLanguage(paid, "ru", "1.0.2676")).rejects.toThrow(/403/);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(await dbModule.kv.get(db, `topic:${entry.id}`)).toEqual(installed);
});


it("downloads the actual Russian recording with RU, never with SL, and keeps it available offline", async () => {
  const sl = await installTopicLanguage(entry, "sl", "1.0.2676");
  const voicePath = "content/ru/0.5.0/retry.mp3";
  expect(await dbModule.topics.getFile(db, entry.id, voicePath)).toBeNull();
  expect(sl.languageContract.packages.ru.audioScope).toBe("feedback");
  fetchMock.mockClear();
  const ru = await installTopicLanguage(entry, "ru", "1.0.2676");
  expect(urls()).toEqual([entry.languageDownload.languages.ru.url.slice(1)]);
  const installedVoice = new Uint8Array(await (await dbModule.topics.getFile(db, entry.id, voicePath)).arrayBuffer());
  const originalVoice = await readFile(resolve("public/audio/addition-subtraction/phrases/look_again.mp3"));
  expect(await sha256Bytes(installedVoice)).toBe(await sha256Bytes(originalVoice));
  expect(ru.languageResources.content.ru.recordings["feedback.retry"]).toBe(voicePath);
  fetchMock.mockImplementation(async () => { throw new Error("offline"); });
  const cached = await installTopicLanguage(entry, "ru", "1.0.2676");
  expect(cached.languageResources.content.ru.recordings["feedback.retry"]).toBe(voicePath);
});


it("upgrades installed 0.4 with both language packages to 0.5 without changing settings, progress or history", async () => {
  const oldCore = await readFile(resolve("test-fixtures/decks/comparison_language_pilot_v0.4.0.zip"));
  const zip = await JSZip.loadAsync(oldCore);
  const manifest = JSON.parse(await zip.file("topic.json").async("string"));
  const oldEntry = { id: entry.id, version: "0.4.0", access: "free", languageDownload: topicDownloadDescriptor({ ...manifest, installation: { coreSha256: await sha256Bytes(oldCore), coreBytes: oldCore.length } }) };
  archives.set(oldEntry.languageDownload.core.url.slice(1), oldCore);
  for (const part of Object.values(oldEntry.languageDownload.languages)) archives.set(part.url.slice(1), await readFile(resolve("test-fixtures", part.url.slice(2))));
  await installTopicLanguage(oldEntry, "ru", "1.0.2676");
  await installTopicLanguage(oldEntry, "sl", "1.0.2676");
  const links = { [`one_${entry.id}`]: { params: { topicContentLanguage: "sl", byMode: { compare_visual: { level: 4, question: "less" }, compare_sign: { level: 1, showEqual: true } } } } };
  const history = [{ id: "existing", topicId: entry.id, modeId: "compare_sign", languageContext: { contentLanguage: "ru", contentVersion: "0.4.0" } }];
  const progress = { one_pilot_visual: { correct: 17 }, one_pilot_sign: { correct: 9 } };
  for (const [key, value] of Object.entries({ studentTopicLinks: links, sessions: history, conceptProgress: progress })) await dbModule.kv.set(db, key, value);
  fetchMock.mockClear();
  const upgraded = await installTopicLanguage(entry, "sl", "1.0.2676");
  expect(urls()).toEqual([entry.languageDownload.core.url.slice(1), entry.languageDownload.languages.sl.url.slice(1)]);
  expect(upgraded.modes).toHaveLength(3);
  expect(Object.keys(upgraded.languageResources.content)).toEqual(["sl"]);
  expect(await dbModule.topics.getFile(db, entry.id, "content/ru/0.4.0/retry.mp3")).toBeNull();
  expect(await dbModule.topics.getFile(db, entry.id, "content/ru/0.5.0/retry.mp3")).toBeNull();
  for (const [key, value] of Object.entries({ studentTopicLinks: links, sessions: history, conceptProgress: progress })) expect(await dbModule.kv.get(db, key)).toEqual(value);
  expect(createContentContext(upgraded, upgraded.modes[2], { contentLanguage: "sl" }).modeId).toBe("compare_draw_sign");
});
