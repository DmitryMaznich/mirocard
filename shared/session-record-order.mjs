export function compareSessionRecords(incoming, saved) {
  if (!saved) return 1;
  const final = record => record.recordState !== "checkpoint";
  // An explicit finish is terminal. Delayed background writes must not reopen it.
  if (final(saved) && !final(incoming)) return -1;
  if (final(incoming) && !final(saved)) return (incoming.recordRevision ?? 0) >= (saved.recordRevision ?? 0) ? 1 : -1;
  const revision = (incoming.recordRevision ?? 0) - (saved.recordRevision ?? 0);
  if (revision) return Math.sign(revision);
  return Math.sign(Date.parse(incoming.recordUpdatedAt ?? incoming.completedAt) - Date.parse(saved.recordUpdatedAt ?? saved.completedAt)) || 0;
}
