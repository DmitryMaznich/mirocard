import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useState } from "react";
import { useAppStore } from "@/core/store";
import Button from "@/shared/components/Button";
import { saveMarketingConsent } from "@/features/account/marketingConsent";

// One-time question for accounts created before the signup form had the news
// checkbox. Any answer (✕ included) is final. `!== false` on purpose: a cached
// account from before this field existed is not asked until the server
// bootstrap has refreshed it.
export default function MarketingPromptCard() {
  const { t } = useUiTranslation();
  const account = useAppStore((s) => s.account);
  const [busy, setBusy] = useState(false);
  if (!account?.id || account.marketingPromptAnswered !== false) return null;

  async function answer(optIn) {
    setBusy(true);
    try {
      await saveMarketingConsent(optIn, "prompt");
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="marketing-prompt" role="region" aria-label={t("marketing.label")}>
      <button type="button" className="marketing-prompt__close" aria-label={t("common.close")} disabled={busy} onClick={() => answer(false)}>
        ✕
      </button>
      <p className="marketing-prompt__text">{t("marketing.prompt")}</p>
      <div className="marketing-prompt__actions">
        <Button data-answer="yes" disabled={busy} onClick={() => answer(true)}>{t("marketing.yes")}</Button>
        <Button data-answer="no" variant="secondary" disabled={busy} onClick={() => answer(false)}>{t("marketing.no")}</Button>
      </div>
    </div>
  );
}
