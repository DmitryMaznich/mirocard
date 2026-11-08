// Notebooks of «Латиница»: kept on the device (localStorage) and, when the app gives `accountKv`
// (src/topics/accountKv.js), in the account as `latin_letters:nb:<id>` documents. The newer copy of
// a notebook wins (updatedAt); a deleted notebook is kept as a tombstone `{ id, deleted, updatedAt }`
// so it does not come back from the other side.
const LOCAL_KEY = "latin_letters:notebooks";
export const KV_PREFIX = "latin_letters:nb:";

export function loadLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function saveLocal(map) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {
    /* storage full or off: the account copy still has it */
  }
}

export function merge(a, b) {
  const out = { ...a };
  for (const [id, nb] of Object.entries(b)) {
    if (!out[id] || (nb?.updatedAt ?? 0) > (out[id]?.updatedAt ?? 0)) out[id] = nb;
  }
  return out;
}

export async function loadAccount(accountKv) {
  if (!accountKv) return {};
  const list = await accountKv.list(KV_PREFIX);
  const out = {};
  for (const { key, value } of list) {
    const nb = typeof value === "string" ? safeParse(value) : value;
    if (nb?.id && key === KV_PREFIX + nb.id) out[nb.id] = nb;
  }
  return out;
}

export function putAccount(accountKv, nb) {
  if (!accountKv) return;
  // offline or refused: the device copy stays
  Promise.resolve().then(() => accountKv.put(KV_PREFIX + nb.id, nb)).catch(() => {});
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
