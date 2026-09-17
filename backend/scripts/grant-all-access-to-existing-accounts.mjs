// One-off migration: give every pre-existing account the "all_access" feature
// flag so the new paywall (Task: trial-and-paywall) doesn't lock out anyone
// who joined back when the whole app was free. New signups after this
// migration get a 7-day trial instead (see grantTrialSubscription).
//
// Run by hand, once, against production:
//
//   MIROCARD_ADMIN_TOKEN=<your prod admin token> \
//   MIROCARD_BASE_URL=https://app.mironium.com \
//     node backend/scripts/grant-all-access-to-existing-accounts.mjs --dry-run
//
// Review the dry-run output, then re-run without --dry-run to apply.
//
// MIROCARD_ADMIN_TOKEN is never read from a file or committed anywhere —
// pass it as an environment variable on the command you run yourself.

const BASE_URL = process.env.MIROCARD_BASE_URL || "http://localhost:3012";
const ADMIN_TOKEN = process.env.MIROCARD_ADMIN_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");

if (!ADMIN_TOKEN) {
  console.error("Missing MIROCARD_ADMIN_TOKEN environment variable.");
  process.exit(1);
}

async function adminFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${ADMIN_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${options.method || "GET"} ${path} -> ${res.status}: ${body}`);
  }
  return res.json();
}

async function main() {
  console.log(`Target: ${BASE_URL}${DRY_RUN ? " (dry run)" : ""}`);

  const accounts = await adminFetch("/admin/accounts");
  console.log(`Found ${accounts.length} account(s).`);

  let skippedHasFlag = 0;
  let skippedDeleted = 0;
  let updated = 0;
  let failed = 0;

  for (const account of accounts) {
    if (account.status === "deleted") {
      skippedDeleted++;
      continue;
    }
    const flags = Array.isArray(account.featureFlags) ? account.featureFlags : [];
    if (flags.includes("all_access")) {
      skippedHasFlag++;
      continue;
    }

    const nextFlags = [...flags, "all_access"];
    console.log(`${DRY_RUN ? "[dry-run] would grant" : "granting"} all_access -> ${account.email}`);

    if (DRY_RUN) {
      updated++;
      continue;
    }

    try {
      await adminFetch("/admin/account/flags", {
        method: "POST",
        body: JSON.stringify({ email: account.email, flags: nextFlags }),
      });
      updated++;
    } catch (err) {
      failed++;
      console.error(`  FAILED for ${account.email}:`, err.message);
    }
  }

  console.log("---");
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already had all_access): ${skippedHasFlag}`);
  console.log(`Skipped (deleted account): ${skippedDeleted}`);
  console.log(`Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
