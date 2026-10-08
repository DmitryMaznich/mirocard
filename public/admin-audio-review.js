/* A standalone reviewer: no app login, synthesis requests, or audio uploads. */
const $ = (id) => document.getElementById(id);
const audio = $("audio");
const storageKey = "mironium.audio-review.v1";
let reviews = {};
let playlists = [];
let current = null;
let selectedId = null;
let queueTimer;
let playbackGeneration = 0;
const localUrls = [];
const statuses = { pending: "Не проверено", ok: "Хорошо", redo: "Переделать" };
try { reviews = JSON.parse(localStorage.getItem(storageKey) || "{}"); if (!reviews || typeof reviews !== "object" || Array.isArray(reviews)) reviews = {}; }
catch { $("message").textContent = "Не удалось прочитать сохранённые оценки. Новые оценки можно скачать в отчёте."; }

function review(item) {
  const saved = reviews[item.id];
  return saved?.version === item.version ? saved : { status: "pending", note: "", version: item.version };
}
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(reviews)); }
  catch { $("message").textContent = "Браузер не разрешил сохранить оценки. Скачайте отчёт перед закрытием страницы."; }
}
function selected() { return current?.items.find((item) => item.id === selectedId); }
function visible() {
  const query = $("search").value.trim().toLocaleLowerCase("ru");
  const category = $("category").value;
  return (current?.items ?? []).filter((item) => (!category || (category === "numbers-and-signs" ? ["Числа", "Знаки"].includes(item.category) : item.category === category))
    && ($("filter").value === "all" || review(item).status === $("filter").value)
    && `${item.label} ${item.path}`.toLocaleLowerCase("ru").includes(query));
}
function stop() {
  clearTimeout(queueTimer);
  playbackGeneration++;
  audio.pause();
}
function select(item, play = false) {
  stop();
  selectedId = item?.id ?? null;
  if (item) {
    // A content fingerprint also busts stale browser audio after regeneration.
    audio.src = item.url.startsWith("blob:") ? item.url : `${item.url}?v=${item.version}`;
  } else { audio.removeAttribute("src"); }
  audio.load();
  render();
  if (play && item) void playCurrent();
}
async function playCurrent() {
  clearTimeout(queueTimer);
  const generation = ++playbackGeneration;
  try { await audio.play(); }
  catch (error) {
    if (generation !== playbackGeneration || error.name === "AbortError") return;
    $("continuous").checked = false;
    $("message").textContent = "Не удалось воспроизвести запись. Нажмите «Прослушать» или проверьте файл; его можно отметить для переделки.";
  }
}
function move(direction, play = true) {
  const items = visible();
  const index = items.findIndex((item) => item.id === selectedId);
  const nextIndex = index < 0 ? (direction > 0 ? 0 : items.length - 1) : index + direction;
  if (items[nextIndex]) select(items[nextIndex], play);
  else stop();
}
function mark(status) {
  const item = selected();
  if (!item) return;
  // Capture the successor before a status filter removes the rated row.
  const items = visible();
  const successor = items[items.findIndex((entry) => entry.id === item.id) + 1];
  reviews[item.id] = { ...review(item), status, updatedAt: new Date().toISOString() };
  persist();
  if ($("advance").checked && status !== "pending" && successor) select(successor, true);
  else { stop(); if (!visible().some((entry) => entry.id === item.id)) select(visible()[0], false); else render(); }
}
function render() {
  const items = visible();
  const item = selected();
  $("tracks").replaceChildren();
  for (const [index, entry] of items.entries()) {
    const button = document.createElement("button");
    button.className = `track${entry.id === selectedId ? " active" : ""}`;
    button.setAttribute("aria-current", String(entry.id === selectedId));
    const ordinal = document.createElement("span"); ordinal.className = "track-index"; ordinal.textContent = String(index + 1);
    const text = document.createElement("span"); text.className = "track-text";
    const label = document.createElement("span"); label.className = "track-label"; label.textContent = entry.label;
    const path = document.createElement("span"); path.className = "track-file"; path.textContent = entry.key;
    text.append(label, path);
    const badge = document.createElement("span"); badge.className = `badge ${review(entry).status}`; badge.textContent = statuses[review(entry).status] ?? statuses.pending;
    button.append(ordinal, text, badge);
    button.addEventListener("click", () => select(entry, true));
    $("tracks").append(button);
  }
  if (!items.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "Записей с такими условиями нет."; $("tracks").append(empty); }
  const counts = { ok: 0, redo: 0, pending: 0 };
  for (const entry of current?.items ?? []) counts[review(entry).status in counts ? review(entry).status : "pending"]++;
  $("summary").textContent = `В списке: ${items.length} · Всего в наборе: ${current?.items.length ?? 0}`;
  $("totals").textContent = `В наборе: хорошо ${counts.ok} · переделать ${counts.redo} · осталось ${counts.pending}`;
  const index = items.findIndex((entry) => entry.id === selectedId);
  $("position").textContent = item ? `${item.category} · ${index + 1} / ${items.length}` : "Нет выбранной записи";
  $("title").textContent = item?.label ?? "Все записи проверены или скрыты фильтром";
  $("path").textContent = item?.path ?? "Измените фильтр, чтобы продолжить.";
  $("note").value = item ? review(item).note : "";
  $("note").disabled = !item;
  $("ok").setAttribute("aria-pressed", String(item && review(item).status === "ok"));
  $("redo").setAttribute("aria-pressed", String(item && review(item).status === "redo"));
  for (const id of ["repeat", "ok", "redo", "pending"]) $(id).disabled = !item;
  $("previous").disabled = index <= 0;
  $("next").disabled = index < 0 || index >= items.length - 1;
  // Keep navigation inside the list; scrollIntoView would hide the player on phones.
  const active = $("tracks").querySelector(".active");
  if (active) {
    const bounds = $("tracks").getBoundingClientRect();
    const row = active.getBoundingClientRect();
    if (row.top < bounds.top) $("tracks").scrollTop += row.top - bounds.top;
    else if (row.bottom > bounds.bottom) $("tracks").scrollTop += row.bottom - bounds.bottom;
  }
}
function switchPlaylist(id) {
  $("message").textContent = "";
  current = playlists.find((entry) => entry.id === id);
  $("search").value = ""; $("filter").value = "all";
  $("category").replaceChildren(new Option("Все разделы", ""));
  for (const category of new Set(current?.items.map((item) => item.category))) $("category").add(new Option(category, category));
  // Start with the exact 31 source recordings used by «Слушаем и считаем».
  if (id === "audio/addition-subtraction") {
    $("category").add(new Option("Числа и знаки", "numbers-and-signs"));
    $("category").value = "numbers-and-signs";
  }
  const url = new URL(location.href); url.searchParams.set("set", id); history.replaceState(null, "", url);
  select(visible()[0], false);
}
function fillPlaylists() {
  $("playlist").replaceChildren();
  for (const playlist of playlists) $("playlist").add(new Option(`${playlist.title} (${playlist.items.length})`, playlist.id));
  $("playlist").disabled = !playlists.length;
}
function report() {
  return { schemaVersion: 1, playlist: { id: current?.id, title: current?.title }, exportedAt: new Date().toISOString(),
    items: (current?.items ?? []).map((item) => ({ path: item.path, key: item.key, label: item.label, category: item.category, ...review(item) })) };
}
function reportText() {
  const data = report();
  const bad = data.items.filter((item) => item.status === "redo");
  return [`Набор: ${data.playlist.title}`, `Переделать: ${bad.length} из ${data.items.length}`, "",
    ...bad.flatMap((item, index) => [`${index + 1}. ${item.label}`, `Файл: ${item.path}`, `Ключ: ${item.key}`, `Версия записи: ${item.version}`, `Комментарий: ${item.note || "—"}`, ""])].join("\n");
}
function download(body, extension, mime) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const link = document.createElement("a"); link.href = url; link.download = `audio-review-${(current?.id ?? "playlist").replace(/[^a-z0-9_-]/gi, "-")}.${extension}`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importFiles(fileList) {
  const files = [...fileList].filter((file) => /\.(mp3|wav|ogg|m4a|webm)$/i.test(file.name));
  if (!files.length) { $("message").textContent = "В выбранных файлах нет аудио MP3, WAV, OGG, M4A или WEBM."; return; }
  stop();
  for (const url of localUrls) URL.revokeObjectURL(url);
  localUrls.length = 0;
  const items = files.map((file) => {
    const path = file.webkitRelativePath || file.name;
    const url = URL.createObjectURL(file); localUrls.push(url);
    return { id: `local:${path}`, key: path.replace(/\.[^.]+$/, ""), path, url, label: file.name.replace(/\.[^.]+$/, ""), category: path.includes("/") ? path.split("/").slice(0, -1).join(" / ") : "Свои файлы", version: `${file.size}:${file.lastModified}` };
  }).sort((a, b) => a.path.localeCompare(b.path, "ru", { numeric: true }));
  playlists = playlists.filter((entry) => entry.id !== "local");
  playlists.push({ id: "local", title: "Свои файлы", items });
  fillPlaylists(); $("playlist").value = "local"; switchPlaylist("local");
  $("message").textContent = `Добавлено файлов: ${items.length}. Они воспроизводятся с вашего устройства.`;
}
$("playlist").addEventListener("change", () => switchPlaylist($("playlist").value));
for (const id of ["search", "category", "filter"]) $(id).addEventListener(id === "search" ? "input" : "change", () => {
  stop(); if (!visible().some((item) => item.id === selectedId)) select(visible()[0]); else render();
});
$("previous").onclick = () => move(-1); $("next").onclick = () => move(1);
$("repeat").onclick = () => { if (selected()) { stop(); audio.currentTime = 0; void playCurrent(); } };
$("ok").onclick = () => mark("ok"); $("redo").onclick = () => mark("redo"); $("pending").onclick = () => mark("pending");
$("note").addEventListener("input", () => { const item = selected(); if (item) { reviews[item.id] = { ...review(item), note: $("note").value, updatedAt: new Date().toISOString() }; persist(); } });
$("continuous").addEventListener("change", () => { clearTimeout(queueTimer); });
audio.addEventListener("ended", () => {
  if (!$("continuous").checked) return;
  queueTimer = setTimeout(() => move(1), Number($("gap").value));
});
audio.addEventListener("pause", () => clearTimeout(queueTimer));
audio.addEventListener("error", () => { if (!selected()) return; stop(); $("continuous").checked = false; $("message").textContent = `Файл не воспроизводится: ${selected().path}. Можно отметить «Переделать» и оставить комментарий.`; });
$("text-export").onclick = () => download("\ufeff" + reportText(), "txt", "text/plain;charset=utf-8");
$("json-export").onclick = () => download(JSON.stringify(report(), null, 2), "json", "application/json");
$("copy").onclick = async () => { try { await navigator.clipboard.writeText(reportText()); $("message").textContent = "Список на переделку скопирован."; } catch { $("message").textContent = "Не удалось скопировать. Используйте «Скачать список .txt»."; } };
for (const id of ["files", "folder"]) $(id).addEventListener("change", (event) => { importFiles(event.target.files); event.target.value = ""; });
document.addEventListener("keydown", (event) => {
  if (event.target.closest("input, textarea, select, audio, a") || (event.key === " " && event.target.closest("button")) || event.ctrlKey || event.altKey || event.metaKey) return;
  if (![" ", "ArrowLeft", "ArrowRight", "1", "2", "0", "r", "R", "к", "К"].includes(event.key)) return;
  event.preventDefault();
  if (event.key === " ") { clearTimeout(queueTimer); if (selected()) { if (audio.paused) void playCurrent(); else audio.pause(); } }
  else if (event.key === "ArrowLeft") move(-1);
  else if (event.key === "ArrowRight") move(1);
  else if (event.key === "1") mark("ok");
  else if (event.key === "2") mark("redo");
  else if (event.key === "0") mark("pending");
  else $("repeat").click();
});
window.addEventListener("pagehide", () => { stop(); for (const url of localUrls) URL.revokeObjectURL(url); });
async function init() {
  try {
    const response = await fetch("/audio-review-manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Manifest unavailable");
    playlists = (await response.json()).playlists;
    fillPlaylists();
    const requested = new URL(location.href).searchParams.get("set");
    const id = playlists.some((entry) => entry.id === requested) ? requested : "audio/addition-subtraction";
    $("playlist").value = id; switchPlaylist(id);
  } catch { $("message").textContent = "Не удалось загрузить наборы. Можно выбрать свои файлы или папку со звуками."; render(); }
}
void init();
