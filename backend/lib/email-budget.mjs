// Resend's free plan has a hard daily quota. Counting our own successful
// sends lets the app pause email signups ("come back tomorrow") instead of
// silently creating accounts whose verification email never arrives.
// Rolling 24h window: we don't know exactly when Resend resets its counter.
const DAY_MS = 24 * 60 * 60 * 1000;
const RETAIN_MS = 7 * DAY_MS;

export class EmailBudgetExceeded extends Error {
  constructor() {
    super("daily email budget exhausted");
    this.code = "email_budget_exhausted";
  }
}

export function createEmailBudget(db, { dailyCap, signupCap, now = () => Date.now() }) {
  const countSince = db.prepare("SELECT COUNT(*) AS c FROM email_send_log WHERE sent_at > ?");
  const insert = db.prepare("INSERT INTO email_send_log (kind, sent_at) VALUES (?, ?)");
  const prune = db.prepare("DELETE FROM email_send_log WHERE sent_at < ?");

  const used = () => countSince.get(now() - DAY_MS).c;
  return {
    used,
    canSend: () => used() < dailyCap,
    canStartSignup: () => used() < signupCap,
    record(kind) {
      const t = now();
      insert.run(String(kind), t);
      prune.run(t - RETAIN_MS);
    },
  };
}
