import { api } from "@/core/api";
import { getDb, kv } from "@/core/db";
import { useAppStore } from "@/core/store";

// Keep in sync with backend/lib/marketing-consent.mjs MARKETING_CONSENT_VERSION:
// changing this wording means bumping the version on both sides.
export const MARKETING_CONSENT_VERSION = "2026-09-26";
export const MARKETING_CONSENT_TEXT =
  "Присылайте мне письма о новых темах и обновлениях Mironium — не чаще пары раз в месяц. Отписаться можно в любой момент.";

export async function saveMarketingConsent(optIn, source) {
  const { account } = await api.patch("/account/marketing", { optIn, source });
  useAppStore.setState({ account });
  try { await kv.set(await getDb(), "account", account); } catch { /* offline cache only */ }
  return account;
}
