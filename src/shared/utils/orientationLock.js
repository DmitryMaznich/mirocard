export const ORIENTATION_LOCK_SCREENS = new Set(["texts", "modes", "params", "concepts", "session"]);

export function normalizeOrientationLock(value) {
  if (value === true) return "portrait";
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();
  if (["none", "any", "auto", "free", "unlock", "unlocked", "false"].includes(normalized)) {
    return null;
  }
  if (normalized.startsWith("portrait")) return normalized;
  if (normalized.startsWith("landscape")) return normalized;
  return null;
}

export function getOrientationLockFrom(...values) {
  for (const value of values) {
    const lock = normalizeOrientationLock(value);
    if (lock) return lock;
  }
  return null;
}

export function getActiveOrientationLock({ screen, topicRecords, activeTopicId, activeModeId }) {
  if (!ORIENTATION_LOCK_SCREENS.has(screen)) return null;

  const topicRecord = (topicRecords ?? []).find((record) => record?.meta?.id === activeTopicId);
  const mode = topicRecord?.modes?.find((item) => item.id === activeModeId);
  const modeLock = getOrientationLockFrom(
    mode?.orientationLock,
    mode?.lockOrientation,
    mode?.orientation,
    mode?.ui?.orientationLock,
    mode?.ui?.lockOrientation,
    mode?.ui?.orientation,
  );
  if (modeLock) return modeLock;

  return getOrientationLockFrom(
    topicRecord?.meta?.orientationLock,
    topicRecord?.meta?.lockOrientation,
    topicRecord?.meta?.orientation,
  );
}
