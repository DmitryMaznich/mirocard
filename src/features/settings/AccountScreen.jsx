import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { api } from "@/core/api";
import { clearUserIdbData } from "@/core/bootstrap";
import AccountCard from "./AccountCard";
import ChangePasswordModal from "./ChangePasswordModal";
import DangerZone from "./DangerZone";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { getPlanLabel, formatPeriodEnd, isUnlimitedPlan } from "@/features/billing/planLabels";
import { PAID_PLANS_PAUSED } from "@/features/billing/entitlement";
import { saveMarketingConsent } from "@/features/account/marketingConsent";

export default function AccountScreen() {
  const { t: tr } = useUiTranslation();
  const setScreen = useAppStore((s) => s.setScreen);
  const logout    = useAppStore((s) => s.logout);
  const subscription = useAppStore((s) => s.subscription);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const account = useAppStore((s) => s.account);
  const [savingMarketing, setSavingMarketing] = useState(false);

  async function handleMarketingToggle(e) {
    const optIn = e.target.checked;
    setSavingMarketing(true);
    try { await saveMarketingConsent(optIn, "settings"); } catch { /* store unchanged → toggle snaps back */ }
    finally { setSavingMarketing(false); }
  }

  async function handleLogout() {
    try { await api.post("/auth/logout"); } catch {
      // Local logout should still proceed when the network request fails.
    }
    const db = await getDb();
    await clearUserIdbData(db);
    logout();
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">{tr("nav.account")}</h1>
      </div>

      <div className="settings-body">
        <AccountCard onLogout={handleLogout} />

        {!PAID_PLANS_PAUSED && <div className="settings-section">
          <div className="settings-section-title">{tr("account.subscription")}</div>
          <div className="settings-row">
            <span className="settings-row__label">
              {!subscription
                ? tr("account.noSubscription")
                : isUnlimitedPlan(subscription.plan)
                  ? getPlanLabel("all_access")
                  : tr("billing.until", { plan: getPlanLabel(subscription.plan), date: formatPeriodEnd(subscription.currentPeriodEnd) })}
            </span>
            <button className="link-btn" onClick={() => setScreen("subscription")}>{tr("account.manageSubscription")}</button>
          </div>
        </div>}

        {account?.id && (
          <div className="settings-section">
            <div className="settings-section-title">{tr("account.mail")}</div>
            <label className="settings-row">
              <span className="settings-row__label">{tr("account.marketing")}</span>
              <input
                type="checkbox"
                name="marketingOptIn"
                checked={!!account.marketingOptIn}
                disabled={savingMarketing}
                onChange={handleMarketingToggle}
              />
            </label>
          </div>
        )}

        <div className="settings-section">
          <div className="settings-section-title">{tr("account.security")}</div>
          <div className="settings-row">
            <span className="settings-row__label">{tr("auth.password")}</span>
            <button className="link-btn" onClick={() => setChangePasswordOpen(true)}>{tr("account.changePassword")}</button>
          </div>
        </div>
      </div>

      <DangerZone />

      {changePasswordOpen && (
        <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />
      )}
    </div>
  );
}
