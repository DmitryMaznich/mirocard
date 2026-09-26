import { useState } from "react";
import { useAppStore } from "@/core/store";
import Button from "@/shared/components/Button";
import { saveMarketingConsent } from "@/features/account/marketingConsent";

// One-time question for accounts created before the signup form had the news
// checkbox. Any answer (✕ included) is final. `!== false` on purpose: a cached
// account from before this field existed is not asked until the server
// bootstrap has refreshed it.
export default function MarketingPromptCard() {
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
    <div className="marketing-prompt" role="region" aria-label="Письма о новых темах">
      <button type="button" className="marketing-prompt__close" aria-label="Закрыть" disabled={busy} onClick={() => answer(false)}>
        ✕
      </button>
      <p className="marketing-prompt__text">Присылать вам письма о новых темах? Не чаще пары раз в месяц.</p>
      <div className="marketing-prompt__actions">
        <Button data-answer="yes" disabled={busy} onClick={() => answer(true)}>Да, присылать</Button>
        <Button data-answer="no" variant="secondary" disabled={busy} onClick={() => answer(false)}>Нет, спасибо</Button>
      </div>
    </div>
  );
}
