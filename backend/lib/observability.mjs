function readEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

// Pluggable via env, no-op otherwise -- deliberately doesn't hardcode a
// vendor (Sentry, PostHog, ...). Set ERROR_REPORTING_WEBHOOK_URL /
// ANALYTICS_WEBHOOK_URL to a vendor's HTTP ingest endpoint (or a small
// relay you own) and these start firing; leave them unset and every call
// here is a single `if` and nothing else. Neither function ever throws --
// an observability call failing must never break the request it's
// instrumenting.

const ERROR_REPORTING_WEBHOOK_URL = readEnv("ERROR_REPORTING_WEBHOOK_URL");
const ANALYTICS_WEBHOOK_URL = readEnv("ANALYTICS_WEBHOOK_URL");

// context must not contain PII (email, name, free-text notes, tokens) --
// callers pass structural identifiers only (accountId is fine: it's an
// opaque UUID, not personal data by itself).
export function reportError(err, context = {}) {
  console.error(err);
  if (!ERROR_REPORTING_WEBHOOK_URL) return;
  const payload = {
    message: err?.message ?? String(err),
    stack: typeof err?.stack === "string" ? err.stack.slice(0, 4000) : undefined,
    context,
    at: new Date().toISOString(),
  };
  fetch(ERROR_REPORTING_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Reporting the error must not itself become a new error to report.
  });
}

// Funnel events -- see docs/commercial-launch-runbook.md for the full list
// this launch instruments and what's still missing (client-only events
// like a landing-page CTA click, and cohort-style D1/D7/D28 activity,
// which needs a scheduled query job rather than a single call site).
// `properties` must stay structural (plan names, amounts, event kinds,
// opaque IDs) -- never email/name/notes text.
export function trackEvent(name, properties = {}) {
  if (!ANALYTICS_WEBHOOK_URL) return;
  fetch(ANALYTICS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: name, properties, at: new Date().toISOString() }),
  }).catch(() => {});
}
