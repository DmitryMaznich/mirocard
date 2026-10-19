import { isLessonLanguage } from "../../shared/languages.mjs";

export function readAccountLanguages(db, accountId) {
  const row = db.prepare("SELECT ui_language, card_language, language_revision FROM account_settings WHERE account_id=?").get(accountId);
  return { uiLanguage: row?.ui_language ?? "ru", cardLanguage: row?.card_language ?? "ru", languageRevision: row?.language_revision ?? 0 };
}

export function patchAccountLanguages(db, accountId, body) {
  const { operationId, expectedRevision, patch, initializeOnly = false } = body ?? {};
  if (typeof operationId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(operationId) ||
      !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
      typeof initializeOnly !== "boolean" || !patch || typeof patch !== "object" || Array.isArray(patch) ||
      Object.keys(patch).length === 0 || !Object.keys(patch).every((key) =>
        key === "uiLanguage" ? ["ru", "sl"].includes(patch[key]) : key === "cardLanguage" && isLessonLanguage(patch[key]))) {
    const error = new Error("Invalid language preference");
    error.status = 400;
    throw error;
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    let result = readAccountLanguages(db, accountId);
    const applied = db.prepare("SELECT 1 FROM account_language_operations WHERE account_id=? AND operation_id=?").get(accountId, operationId);
    if (!applied && (!initializeOnly || result.languageRevision === 0)) {
      if (result.languageRevision !== expectedRevision) {
        db.exec("COMMIT");
        return { ...result, conflict: true };
      }
      const fields = Object.keys(patch);
      const columns = { uiLanguage: "ui_language", cardLanguage: "card_language" };
      db.prepare(`UPDATE account_settings SET ${fields.map(key => columns[key] + "=?").join(",")}, language_revision=language_revision+1, updated_at=? WHERE account_id=?`)
        .run(...fields.map(key => patch[key]), new Date().toISOString(), accountId);
      // Increment the usual account revision as well for existing sync clients.
      db.prepare("INSERT INTO sync_revision(account_id,revision) VALUES (?,1) ON CONFLICT(account_id) DO UPDATE SET revision=revision+1").run(accountId);
      result = readAccountLanguages(db, accountId);
    }
    if (!applied) db.prepare("INSERT INTO account_language_operations(account_id,operation_id) VALUES (?,?)").run(accountId, operationId);
    db.exec("COMMIT");
    return { ...result, conflict: false };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
