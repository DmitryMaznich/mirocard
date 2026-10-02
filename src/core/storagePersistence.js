// Persistence is granted per origin, not per IndexedDB store or topic. A single
// successful request protects the app's local user data and downloaded decks.
const DENIED_AT_KEY = "mirocard:storage-persistence-denied-at";
const RETRY_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export const STORAGE_PERSISTENCE_EVENT = "mirocard:storage-persistence";

let requestInFlight = null;

function readDeniedAt() {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(DENIED_AT_KEY)) || 0;
  } catch {
    return 0;
  }
}

function rememberResult(granted) {
  if (typeof window === "undefined") return;
  try {
    if (granted) window.localStorage.removeItem(DENIED_AT_KEY);
    else window.localStorage.setItem(DENIED_AT_KEY, String(Date.now()));
  } catch {
    // Browsers can disable localStorage while still allowing IndexedDB.
  }
}

function notifyStatus(status) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(STORAGE_PERSISTENCE_EVENT, { detail: status }));
  }
}

export async function getStoragePersistenceStatus() {
  if (typeof navigator === "undefined" || typeof navigator.storage?.persisted !== "function"
      || typeof navigator.storage?.persist !== "function") {
    return "unsupported";
  }
  try {
    return await navigator.storage.persisted() ? "granted" : "not_granted";
  } catch {
    return "error";
  }
}

// Call directly from a user gesture. A denial is not an app error and never
// prevents a save; automatic retries are spaced out to avoid repeated prompts.
export function requestStoragePersistence({ force = false } = {}) {
  if (typeof navigator === "undefined" || typeof navigator.storage?.persist !== "function") {
    return Promise.resolve("unsupported");
  }
  if (requestInFlight) return requestInFlight;
  const deniedAt = readDeniedAt();
  if (!force && deniedAt > 0 && Date.now() - deniedAt < RETRY_AFTER_MS) {
    return Promise.resolve("not_granted");
  }

  let request;
  try {
    // Start before yielding so Firefox can associate its prompt with the tap.
    request = navigator.storage.persist();
  } catch {
    return Promise.resolve("error");
  }

  requestInFlight = Promise.resolve(request)
    .then((granted) => {
      rememberResult(granted);
      const status = granted ? "granted" : "not_granted";
      notifyStatus(status);
      return status;
    })
    .catch(() => "error")
    .finally(() => { requestInFlight = null; });
  return requestInFlight;
}
