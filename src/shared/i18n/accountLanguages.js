import { isUiLanguage } from "./uiLanguage.js";
import { isLessonLanguage } from "../../../shared/languages.mjs";

export const ACCOUNT_LANGUAGES_KEY = "mironium.accountLanguages";
const validRevision = (value) => Number.isSafeInteger(value) && value >= 0;
const validPatch = (patch) => patch && Object.keys(patch).length > 0 &&
  Object.keys(patch).every((key) => key === "uiLanguage" ? isUiLanguage(patch[key]) : key === "cardLanguage" && isLessonLanguage(patch[key]));

// One durable, account-scoped operation. A newer local choice replaces its
// payload; an old response can acknowledge only its own operation ID.
export function createAccountLanguages({ storage, applyLanguage, request, makeId = () => crypto.randomUUID() }) {
  let records = {};
  try {
    const raw = JSON.parse(storage?.getItem(ACCOUNT_LANGUAGES_KEY) ?? "{}");
    if (raw && typeof raw === "object" && !Array.isArray(raw)) records = raw;
  } catch { /* Storage may be unavailable or contain an old/corrupt value. */ }
  let context = null;
  let generation = 0;
  let guestChoice = null;
  try {
    // LOC-01 also wrote its implicit ru default into the boot cache. Only
    // migrate a non-default legacy value as a choice; new guest selections
    // have their own explicit marker, including a deliberate ru choice.
    const legacy = Object.keys(records).length === 0 ? storage?.getItem("mironium.uiLanguage") : null;
    const saved = storage?.getItem("mironium.guestUiLanguage") ??
      (legacy === "sl" ? legacy : null);
    if (isUiLanguage(saved)) guestChoice = saved;
  } catch { /* guest choice still works in memory */ }
  let snapshot = Object.freeze({ accountId: null, cardLanguage: "ru", status: "local", durable: true });
  const listeners = new Set();
  let flight = null;

  function publish(patch) {
    const next = { ...snapshot, ...patch };
    if (Object.keys(next).some((key) => next[key] !== snapshot[key])) {
      snapshot = Object.freeze(next);
      listeners.forEach((listener) => listener());
    }
  }
  function save() {
    let durable = false;
    try {
      if (storage) { storage.setItem(ACCOUNT_LANGUAGES_KEY, JSON.stringify(records)); durable = true; }
    } catch { /* Keep the in-memory operation, with an explicit warning. */ }
    publish({ durable });
  }
  function record(id) {
    const raw = Object.hasOwn(records, id) ? records[id] : null;
    if (!raw || !validRevision(raw.revision)) {
      Object.defineProperty(records, id, { value: { revision: 0, uiLanguage: "ru", cardLanguage: "ru" }, writable: true, enumerable: true, configurable: true });
    }
    const value = records[id];
    if (!isUiLanguage(value.uiLanguage)) value.uiLanguage = "ru";
    if (!isLessonLanguage(value.cardLanguage)) value.cardLanguage = "ru";
    if (value.pending && (!validPatch(value.pending.patch) || typeof value.pending.id !== "string" || !validRevision(value.pending.expectedRevision))) delete value.pending;
    return value;
  }
  function apply(value) {
    const patch = value.pending?.patch ?? {};
    const language = patch.uiLanguage ?? value.uiLanguage;
    if (isUiLanguage(language)) applyLanguage(language);
    publish({ cardLanguage: patch.cardLanguage ?? value.cardLanguage ?? "ru", status: value.pending ? "pending" : "synced" });
  }
  function queue(patch, initializeOnly = false) {
    const value = record(context.accountId);
    value.pending = {
      id: makeId(), patch: { ...value.pending?.patch, ...patch },
      expectedRevision: value.revision, initializeOnly,
    };
    save();
    apply(value);
    void flush();
  }
  async function flush() {
    if (!context?.token) return;
    if (!record(context.accountId).pending) return;
    if (flight?.generation === generation) return flight.promise;
    const owner = context;
    const epoch = generation;
    const current = () => context === owner && generation === epoch;
    const promise = (async () => {
      // Bound conflict retries; the periodic/online retry handles continued contention.
      for (let attempt = 0; attempt < 3 && current(); attempt++) {
        const value = record(owner.accountId);
        const op = value.pending;
        if (!op) return;
        try {
          const result = await request(owner.token, {
            operationId: op.id, expectedRevision: op.expectedRevision,
            patch: op.patch, initializeOnly: op.initializeOnly,
          });
          if (!current()) return;
          if (!validRevision(result.languageRevision)) throw new Error("Invalid language revision");
          if (!result.conflict && !op.initializeOnly && result.languageRevision <= op.expectedRevision &&
              Object.entries(op.patch).some(([key, value]) => result[key] !== value)) {
            // A default/no-op response has not confirmed this write. Keep the
            // durable operation and the manual UI choice until a valid retry.
            throw new Error("Language preference was not saved");
          }
          if (result.languageRevision >= value.revision) {
            value.revision = result.languageRevision;
            if (isUiLanguage(result.uiLanguage)) value.uiLanguage = result.uiLanguage;
            if (isLessonLanguage(result.cardLanguage)) value.cardLanguage = result.cardLanguage;
          }
          if (value.pending?.id === op.id) {
            if (result.conflict) {
              // Deliberate, unsent local choices win over a late pull. Rebase
              // against the server revision, never against a device clock.
              value.pending.expectedRevision = value.revision;
            } else delete value.pending;
          } else if (value.pending) value.pending.expectedRevision = value.revision;
          save();
          apply(value);
        } catch {
          if (current()) publish({ status: "pending" });
          return;
        }
      }
    })();
    flight = { generation: epoch, promise };
    try { await promise; } finally { if (flight?.promise === promise) flight = null; }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    chooseUiLanguage(language) {
      if (!isUiLanguage(language)) return;
      if (!context) {
        guestChoice = language;
        try { storage?.setItem("mironium.guestUiLanguage", language); } catch { /* memory fallback */ }
        return;
      }
      queue({ uiLanguage: language });
    },
    chooseCardLanguage(language) {
      if (!isLessonLanguage(language)) return;
      if (context) queue({ cardLanguage: language });
    },
    reconcile({ accountId, token, settings } = {}) {
      if (!accountId || !token) return;
      if (context?.accountId !== accountId || context.token !== token) {
        context = { accountId, token };
        generation++;
        publish({ accountId });
      }
      const value = record(accountId);
      if (validRevision(settings?.languageRevision) && settings.languageRevision >= value.revision) {
        value.revision = settings.languageRevision;
        if (isUiLanguage(settings.uiLanguage)) value.uiLanguage = settings.uiLanguage;
        if (isLessonLanguage(settings.cardLanguage)) value.cardLanguage = settings.cardLanguage;
      }
      // Only an account with no explicit preference adopts a guest selection.
      // consume it once, so switching accounts cannot copy another user's choice.
      const guest = guestChoice;
      guestChoice = null;
      try { storage?.removeItem("mironium.guestUiLanguage"); } catch { /* memory fallback */ }
      if (guest && value.revision === 0 && !value.pending) queue({ uiLanguage: guest }, true);
      else { save(); apply(value); void flush(); }
    },
    disconnect() {
      context = null;
      generation++;
      guestChoice = null;
      publish({ accountId: null, cardLanguage: "ru", status: "local" });
    },
    flush,
  };
}
