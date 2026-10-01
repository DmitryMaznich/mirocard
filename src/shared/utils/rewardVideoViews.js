// Each browser keeps its own increasing count. Taking maxima makes retries
// idempotent and merging devices preserves every device's contributions.
export function mergeRewardVideoViews(...sources) {
  const result = {};
  for (const source of sources) {
    for (const [videoId, replicas] of Object.entries(source ?? {})) {
      if (!/^[\w-]{11}$/.test(videoId) || !replicas || typeof replicas !== "object") continue;
      for (const [replica, count] of Object.entries(replicas)) {
        if (!/^[\w-]{1,100}$/.test(replica) || !Number.isSafeInteger(count) || count < 0) continue;
        if (!Object.hasOwn(result, videoId)) {
          Object.defineProperty(result, videoId, { value: {}, enumerable: true });
        }
        Object.defineProperty(result[videoId], replica, {
          value: Math.max(Object.hasOwn(result[videoId], replica) ? result[videoId][replica] : 0, count),
          enumerable: true, configurable: true, writable: true,
        });
      }
    }
  }
  return result;
}

export function rewardVideoViewCount(views, videoId) {
  return Object.values(mergeRewardVideoViews(views)[videoId] ?? {}).reduce((sum, count) => sum + count, 0);
}
