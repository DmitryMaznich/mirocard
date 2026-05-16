import { extractYoutubeId, getVideoUrl } from "./format";

const STORAGE_PREFIX = "mirocard:lastRewardVideo:";

export function normalizeRewardVideoIds(videos) {
  if (!Array.isArray(videos)) return [];
  const ids = videos
    .map((video) => extractYoutubeId(getVideoUrl(video)))
    .filter(Boolean);
  return [...new Set(ids)];
}

export function pickRewardVideoId(videoIds, previousVideoId = null, random = Math.random) {
  const ids = normalizeRewardVideoIds(videoIds);
  if (!ids.length) return null;
  if (ids.length === 1) return ids[0];

  const pool = ids.filter((id) => id !== previousVideoId);
  const choices = pool.length ? pool : ids;
  const index = Math.floor(random() * choices.length);
  return choices[Math.max(0, Math.min(index, choices.length - 1))] ?? null;
}

function storageKey(scope) {
  return `${STORAGE_PREFIX}${scope || "global"}`;
}

export function getLastRewardVideoId(scope) {
  try {
    return window.localStorage?.getItem(storageKey(scope)) || null;
  } catch {
    return null;
  }
}

export function setLastRewardVideoId(scope, videoId) {
  if (!videoId) return;
  try {
    window.localStorage?.setItem(storageKey(scope), videoId);
  } catch {
    // Reward rotation still works for the current pick when storage is unavailable.
  }
}

export function pickStoredRewardVideoId(videos, scope, random = Math.random) {
  const previous = getLastRewardVideoId(scope);
  const selected = pickRewardVideoId(videos, previous, random);
  setLastRewardVideoId(scope, selected);
  return selected;
}
