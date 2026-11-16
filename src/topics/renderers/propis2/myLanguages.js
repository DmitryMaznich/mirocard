// «Мои языки» (docs/mockups/propis2-languages-journey.html, owner 2026-11-16): one «Прописи» with every alphabet, and each adult sees only the
// languages they picked — the ready notebooks, the language of a new notebook, the letter cards, the dictation. A list of the ACCOUNT (one
// adult, several devices, a whole class of students), not of a student. Only a deck that says so (`meta.myLanguages`, the build's flag) uses
// it — first «Прописи: латиница» as the try-out; a deck without it is exactly as before.
//   - a language in work (`status: "draft"`) is offered only to an account with the feature flag `draft_languages`, unless it was
//     published on purpose (`publishDraft`): then to everyone, marked «черновик»;
//   - the first list (nothing saved yet): the app's interface language + the languages of the notebooks already made, else the deck's first;
//   - a notebook of a language taken off the list stays in «Мои тетради» (owner: data is never hidden), with its language mark.
// Stored as the account document `propis2:prefs` ({ langs, updatedAt }, the app's offline queue `kv.upsert`, last write wins) and copied on
// the device (IndexedDB keyval, same key) — so it works offline and the mode list outside the topic can read it.
import { kv, getDb } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import { deckLanguages } from "./languages.js";

export const PREFS_KEY = "propis2:prefs";
export const DRAFT_FLAG = "draft_languages";

export const myLanguagesOn = (record) => Boolean(record?.meta?.myLanguages) && Boolean(deckLanguages(record));

// the deck's languages this account may pick (drafts only with the flag)
export function offeredLanguages(record, flags = []) {
  const all = deckLanguages(record) ?? [];
  const drafts = Array.isArray(flags) && flags.includes(DRAFT_FLAG);
  // (a draft published on purpose, `publishDraft` — the Slovenian one, owner 2026-11-14: «сразу в латиницу для всех» — is offered to everyone,
  // marked «черновик»; any other draft only to an account with the flag)
  return all.filter((l) => l.status !== "draft" || l.publishDraft || drafts);
}

// the list in use: the saved one (only languages still offered, in the deck's order), else the first list
export function resolveMyLanguages(record, saved, { uiLanguage = "ru", notebookLangs = [], flags = [] } = {}) {
  const offered = offeredLanguages(record, flags);
  const ids = new Set(offered.map((l) => l.id));
  const pick = (list) => offered.filter((l) => list.includes(l.id)).map((l) => l.id);
  if (Array.isArray(saved) && pick(saved).length) return pick(saved);
  const first = pick([uiLanguage, ...notebookLangs].filter((id) => ids.has(id)));
  return first.length ? first : offered.slice(0, 1).map((l) => l.id);
}

// Cyrillic or Latin (the sheet groups the languages by their script, the reader's own first)
const LATIN = /[a-z]/i;
export function scriptOf(lang) {
  const lower = lang?.alphabet?.lower;
  return lower && LATIN.test([...lower][0] ?? "") ? "latin" : "cyrillic";
}
// two letters to show what the language looks like: its OWN letters when it has some (Ә Ғ, Č Š), else its first two
const RU = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя";
const EN = "abcdefghijklmnopqrstuvwxyz";
export function sampleLetters(lang) {
  const lower = [...(lang?.alphabet?.lower ?? RU)];
  const own = lower.filter((ch) => !RU.includes(ch) && !EN.includes(ch));
  const two = (own.length >= 2 ? own : lower).slice(0, 2);
  return two.map((ch) => `${ch.toLocaleUpperCase()}${ch}`).join(" ");
}

export async function loadMyLanguagesDoc(db) {
  const database = db ?? (await getDb());
  const doc = await kv.get(database, PREFS_KEY);
  return doc && Array.isArray(doc.langs) ? doc : null;
}

// saved on the device at once, sent to the account through the offline queue
export async function saveMyLanguages(langs, db, now = Date.now()) {
  const database = db ?? (await getDb());
  const doc = { langs: [...langs], updatedAt: now };
  await kv.set(database, PREFS_KEY, doc);
  try { await pushOp("kv.upsert", { key: PREFS_KEY, value: doc }); } catch { /* offline / signed out: the device copy stands */ }
  return doc;
}

// the account's newer copy kept on the device (no write back: it came from there)
export async function keepMyLanguagesLocal(doc, db) {
  await kv.set(db ?? (await getDb()), PREFS_KEY, doc);
}

// the account's copy (from GET /account/kv?prefix=propis2:), when newer than the device's
export function newerRemotePrefs(items, local) {
  const remote = (items ?? []).find((i) => i?.key === PREFS_KEY)?.value;
  if (!remote || !Array.isArray(remote.langs)) return null;
  return !local || (remote.updatedAt ?? 0) > (local.updatedAt ?? 0) ? remote : null;
}

export { withMyLanguages } from "./myLanguagesView.js";

// The list resolved for a deck on this device (the saved one, else the first list from the interface language and the notebooks made),
// for the store: the mode list outside the topic needs it before «Мои тетради» was ever opened.
export async function resolveMyLanguagesNow(record, { flags = [], uiLanguage = "ru", db } = {}) {
  const doc = await loadMyLanguagesDoc(db).catch(() => null);
  let notebookLangs = [];
  if (!doc) {
    const database = db ?? (await getDb());
    const lib = await kv.get(database, "propis2:library").catch(() => null);
    notebookLangs = [...new Set((lib?.sets ?? []).map((st) => st.lang ?? "ru"))];
  }
  return resolveMyLanguages(record, doc?.langs, { uiLanguage, notebookLangs, flags });
}
