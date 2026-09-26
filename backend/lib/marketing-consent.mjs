// Consent to "what's new" emails: separate from personal-data consent,
// opt-in only, provable (who, when, which wording, where it was given).
// The wording itself lives in the frontend (src/features/account/marketingConsent.js);
// bump this together with it.
export const MARKETING_CONSENT_VERSION = "2026-09-26";
export const MARKETING_CONSENT_SOURCES = ["register", "google_signup", "settings", "prompt"];

export function setMarketingConsent(db, accountId, { optIn, source }) {
  if (!MARKETING_CONSENT_SOURCES.includes(source)) throw { status: 400, message: "Invalid source" };
  const current = db.prepare("SELECT marketing_opt_in FROM accounts WHERE id = ?").get(accountId);
  if (!current) throw { status: 404, message: "Account not found" };

  const ts = new Date().toISOString();
  const want = optIn ? 1 : 0;
  if (current.marketing_opt_in !== want) {
    db.prepare(`
      INSERT INTO marketing_consent_events (account_id, action, text_version, source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(accountId, want ? "grant" : "withdraw", MARKETING_CONSENT_VERSION, source, ts);
  }
  db.prepare(`
    UPDATE accounts
       SET marketing_opt_in = ?,
           marketing_prompt_answered_at = COALESCE(marketing_prompt_answered_at, ?),
           updated_at = ?
     WHERE id = ?
  `).run(want, ts, ts, accountId);
}
