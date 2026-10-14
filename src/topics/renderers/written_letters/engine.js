// "Письменные буквы" was merged into `propis` on 2026-09-29 and hidden from the catalog
// (meta.hidden + catalog "hidden"). Its modes live in propis/letters/ and, since 2026-10-10,
// are also modes of `propis2` -- the topic now titled «Прописи» (`propis` is «Прописи старые», hidden). This stub only
// keeps a device that still has the old deck installed from crashing if it ever reaches
// a session for it -- one task that tells the family where the exercises went.
export function generateTasks() {
  return [{ type: "moved" }];
}
