import { extractYoutubeId, getVideoUrl } from "./format";

const LAST_PREFIX = "mirocard:lastRewardVideo:";
const SHOWN_PREFIX = "mirocard:shownRewardVideos:";

export function normalizeRewardVideoIds(videos) {
  if (!Array.isArray(videos)) return [];
  const ids = videos
    .map((video) => extractYoutubeId(getVideoUrl(video)))
    .filter(Boolean);
  return [...new Set(ids)];
}

/**
 * Picks the next reward video. Videos not yet in `shownIds` (this cycle)
 * are preferred over ones already shown — this guarantees every video gets
 * a turn before any of them repeats, rather than relying on long-run
 * uniform-random odds alone (fair on average, but can still streak a few
 * old favorites early while a newly-added video hasn't come up yet by pure
 * chance). Once every video has been shown, the cycle restarts from the
 * full list — still skipping the video that literally just played, so the
 * restart doesn't show the same clip twice in a row.
 */
export function pickRewardVideoId(videoIds, previousVideoId = null, shownIds = [], random = Math.random) {
  const ids = normalizeRewardVideoIds(videoIds);
  if (!ids.length) return null;
  if (ids.length === 1) return ids[0];

  const shown = new Set(shownIds);
  const unseen = ids.filter((id) => !shown.has(id));

  const choices = unseen.length
    ? unseen
    : (() => {
        const freshPool = ids.filter((id) => id !== previousVideoId);
        return freshPool.length ? freshPool : ids;
      })();

  const index = Math.floor(random() * choices.length);
  return choices[Math.max(0, Math.min(index, choices.length - 1))] ?? null;
}

// ─── Rotation state ──────────────────────────────────────────────────────────
// One document per scope: { shown: [ids of the current cycle], last, rev }.
//
// It is kept in three places, because no single one was reliable on a
// low-end Android tablet: localStorage there kept handing back an old state
// after every restart (writes that never reached the disk), so the cycle
// froze on the same handful of "unseen" clips for hours.
//   1. memory   — the truth while the app is open;
//   2. account  — the server copy (`kv.upsert`), loaded when a reward opens,
//                 so a restart or a broken local storage resumes the cycle;
//   3. localStorage — only a fallback for offline starts.
// The copy with the higher `rev` wins; every pick writes rev + 1.

const STATE_PREFIX = "mirocard:rewardVideoRotation:";
const ACCOUNT_PREFIX = "reward_video_rotation:";
const memory = new Map();

function normalizeState(raw) {
  if (!raw || typeof raw !== "object") return null;
  const shown = Array.isArray(raw.shown) ? raw.shown.filter((id) => typeof id === "string") : [];
  const last = typeof raw.last === "string" ? raw.last : null;
  const rev = Number.isSafeInteger(raw.rev) && raw.rev >= 0 ? raw.rev : 0;
  return { shown, last, rev };
}

function readLocalState(scope) {
  try {
    const raw = window.localStorage?.getItem(STATE_PREFIX + (scope || "global"));
    return raw ? normalizeState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocalState(scope, state) {
  const key = STATE_PREFIX + (scope || "global");
  try {
    window.localStorage?.setItem(key, JSON.stringify(state));
  } catch {
    try { window.localStorage?.removeItem(key); } catch { /* memory still rotates */ }
  }
}

function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  return b.rev > a.rev ? b : a;
}

function currentState(scope) {
  return memory.get(scope || "global") ?? readLocalState(scope) ?? { shown: [], last: null, rev: 0 };
}

function setState(scope, state) {
  memory.set(scope || "global", state);
  writeLocalState(scope, state);
}

// The state writer for the account copy; replaced in tests.
let accountWriter = async (key, value) => {
  const { pushOp } = await import("@/core/syncApi");
  await pushOp("kv.upsert", { key, value });
};
let accountReader = async (key) => {
  const { api } = await import("@/core/api");
  const res = await api.get(`/account/kv?prefix=${encodeURIComponent(key)}`);
  return (Array.isArray(res?.kv) ? res.kv : []).find((item) => item.key === key)?.value ?? null;
};

function accountKey(scope) {
  return ACCOUNT_PREFIX + (scope || "global");
}

/**
 * Loads the account copy of the rotation, so the next pick continues the
 * cycle the student is actually in. Call when a reward opens, before Watch.
 * Offline or signed out it does nothing: the local state is used.
 */
export async function preloadRewardVideoRotation(scope) {
  try {
    const remote = normalizeState(await accountReader(accountKey(scope)));
    const local = currentState(scope);
    const winner = newer(local, remote);
    if (winner !== local) setState(scope, winner);
  } catch {
    // Offline or signed out: keep rotating locally.
  }
}

export function getLastRewardVideoId(scope) {
  return currentState(scope).last;
}

export function getShownRewardVideoIds(scope) {
  return currentState(scope).shown;
}

/** Test hooks. */
export function resetRewardVideoMemory() {
  memory.clear();
}
export function setRewardVideoAccountStore({ read, write }) {
  if (read) accountReader = read;
  if (write) accountWriter = write;
}

export function pickStoredRewardVideoId(videos, scope, random = Math.random) {
  const ids = normalizeRewardVideoIds(videos);
  const state = currentState(scope);
  // Drop ids no longer in the current list (a video was removed) so a
  // shrunk/edited list can't get permanently stuck thinking everything's
  // already been shown.
  const shown = state.shown.filter((id) => ids.includes(id));

  const selected = pickRewardVideoId(videos, state.last, shown, random);
  if (selected) {
    const unseen = ids.filter((id) => !shown.includes(id));
    // An empty unseen pool means pickRewardVideoId fell back to the full
    // list (every video had already been shown) — this selection starts a
    // fresh cycle instead of extending the old, now-complete one.
    const next = {
      shown: unseen.length ? [...shown, selected] : [selected],
      last: selected,
      rev: state.rev + 1,
    };
    setState(scope, next);
    accountWriter(accountKey(scope), next).catch(() => {});
  }
  return selected;
}
