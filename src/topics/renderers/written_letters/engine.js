// "Письменные буквы" was merged into "Прописи" on 2026-09-29 and hidden from the catalog
// (meta.hidden + catalog "hidden"). Its modes now live in propis/letters/. This stub only
// keeps a device that still has the old deck installed from crashing if it ever reaches
// a session for it -- one task that tells the family where the exercises went.
export function generateTasks() {
  return [{ type: "moved" }];
}
