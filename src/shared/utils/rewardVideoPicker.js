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

function lastStorageKey(scope) {
  return `${LAST_PREFIX}${scope || "global"}`;
}

function shownStorageKey(scope) {
  return `${SHOWN_PREFIX}${scope || "global"}`;
}

export function getLastRewardVideoId(scope) {
  try {
    return window.localStorage?.getItem(lastStorageKey(scope)) || null;
  } catch {
    return null;
  }
}

export function setLastRewardVideoId(scope, videoId) {
  if (!videoId) return;
  try {
    window.localStorage?.setItem(lastStorageKey(scope), videoId);
  } catch {
    // Reward rotation still works for the current pick when storage is unavailable.
  }
}

export function getShownRewardVideoIds(scope) {
  try {
    const raw = window.localStorage?.getItem(shownStorageKey(scope));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setShownRewardVideoIds(scope, ids) {
  try {
    window.localStorage?.setItem(shownStorageKey(scope), JSON.stringify(ids));
  } catch {
    // Cycle tracking still works for the current pick when storage is unavailable.
  }
}

export function pickStoredRewardVideoId(videos, scope, random = Math.random) {
  const ids = normalizeRewardVideoIds(videos);
  const previous = getLastRewardVideoId(scope);
  // Drop ids no longer in the current list (a video was removed) so a
  // shrunk/edited list can't get permanently stuck thinking everything's
  // already been shown.
  const shown = getShownRewardVideoIds(scope).filter((id) => ids.includes(id));

  const selected = pickRewardVideoId(videos, previous, shown, random);
  if (selected) {
    setLastRewardVideoId(scope, selected);
    const unseen = ids.filter((id) => !shown.includes(id));
    // An empty unseen pool means pickRewardVideoId fell back to the full
    // list (every video had already been shown) — this selection starts a
    // fresh cycle instead of extending the old, now-complete one.
    setShownRewardVideoIds(scope, unseen.length ? [...shown, selected] : [selected]);
  }
  return selected;
}
