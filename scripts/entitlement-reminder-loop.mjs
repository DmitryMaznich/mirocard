import { getDb } from "../backend/lib/db.mjs";
import { findEntitlementsNeedingReminders, markReminderSent } from "../backend/lib/billing-repository.mjs";
import { sendEntitlementReminderEmail } from "../backend/lib/mailer.mjs";

const HOUR_MS = 60 * 60 * 1000;

export async function runReminderSweepOnce(db) {
  const due = findEntitlementsNeedingReminders(db);
  for (const { kind, entitlement, email } of due) {
    try {
      await sendEntitlementReminderEmail(email, { kind, endsAt: entitlement.ends_at, plan: entitlement.plan });
      markReminderSent(db, entitlement.id, kind);
    } catch (err) {
      // Leave the reminder unmarked so the next hourly sweep retries it --
      // an email provider hiccup must not silently skip the reminder
      // forever, only delay it.
      console.error(`[entitlement-reminder] failed to send ${kind} reminder for entitlement ${entitlement.id}:`, err.message);
    }
  }
  return due.length;
}

export function startReminderLoop({ intervalMs = HOUR_MS } = {}) {
  const db = getDb();
  runReminderSweepOnce(db).catch((err) => console.error("[entitlement-reminder] sweep failed:", err));
  return setInterval(() => {
    runReminderSweepOnce(db).catch((err) => console.error("[entitlement-reminder] sweep failed:", err));
  }, intervalMs);
}

if (process.argv[1]?.endsWith("entitlement-reminder-loop.mjs")) {
  const once = process.argv.includes("--once");
  if (once) {
    await runReminderSweepOnce(getDb());
  } else {
    startReminderLoop();
  }
}
