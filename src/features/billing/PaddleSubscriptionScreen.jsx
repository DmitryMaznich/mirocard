import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { getPlanLabel, formatPeriodEnd, daysLeft, isUnlimitedPlan } from "./planLabels";
import { openPaddleCheckout, closePaddleCheckout } from "./paddleCheckout";

// Auto-renewing Paddle subscription (docs/monetization-eu-plan.md, mockups
// docs/mockups/billing-2026-11-07/billing-v01.html, screens 1 and 4–6).
// Which view shows is decided by Paddle's state as our server last heard it
// (subscription.provider, from the webhooks):
//   no live subscription      → plans + «Оформить» (screen 1)
//   past_due                  → «Не удалось списать оплату» (6)
//   cancellation scheduled    → «Отменена — доступ до …» + «Возобновить» (5)
//   renewing                  → «Активна» + portal rows (4)
// Card, plan change, invoices and cancelling live in Paddle's customer portal.

const PLAN_ORDER = ["annual", "half_year", "monthly"];

export function subscriptionView(subscription) {
  const provider = subscription?.provider;
  if (!provider || provider.status === "canceled" || provider.status === "paused") return "plans";
  if (provider.status === "past_due") return "past_due";
  if (provider.scheduledCancelAt) return "canceled";
  if (provider.renews) return "active";
  return "plans";
}

// window.open must run inside the click itself (iOS Safari blocks a popup
// opened after an await), so a blank tab is opened first and pointed at the
// portal link once the server returns it. No tab (blocked) → same tab.
async function openPortalLink(which) {
  const tab = window.open("", "_blank");
  try {
    const urls = await api.post("/billing/portal", {});
    const url = urls?.[which] || urls?.overviewUrl;
    if (!url) throw new Error("no_portal_url");
    if (tab && !tab.closed) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (err) {
    if (tab && !tab.closed) tab.close();
    throw err;
  }
}

export default function PaddleSubscriptionScreen() {
  const { t: tr, language } = useUiTranslation();
  const setScreen = useAppStore((s) => s.setScreen);
  const setCheckout = useAppStore((s) => s.setCheckout);
  const setSubscription = useAppStore((s) => s.setSubscription);
  const setPendingCheckoutPlan = useAppStore((s) => s.setPendingCheckoutPlan);
  const pendingCheckoutPlan = useAppStore((s) => s.pendingCheckoutPlan);
  const subscription = useAppStore((s) => s.subscription);

  const [planId, setPlanId] = useState(PLAN_ORDER.includes(pendingCheckoutPlan) ? pendingCheckoutPlan : "annual");
  const [paddleStatus, setPaddleStatus] = useState(null); // { enabled, environment } | null while loading
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { setPendingCheckoutPlan?.(null); }, [setPendingCheckoutPlan]);

  // Paddle's state changes outside the app (portal tab, webhooks), so read it
  // fresh on open and whenever the parent comes back to this tab.
  const refresh = useCallback(async () => {
    try {
      setSubscription(await api.get("/billing/subscription"));
    } catch { /* keep what the store has */ }
  }, [setSubscription]);

  useEffect(() => {
    refresh();
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    api.get("/auth/signup-status")
      .then((s) => { if (alive) setPaddleStatus(s?.paddle ?? { enabled: false }); })
      .catch(() => { if (alive) setPaddleStatus({ enabled: false }); });
    return () => { alive = false; };
  }, []);

  const plans = {
    annual: { name: tr("billing.year"), hint: tr("billing.p.yearHint"), price: tr("billing.p.yearPrice"), badge: tr("billing.p.yearBadge") },
    half_year: { name: tr("billing.halfYear"), hint: tr("billing.p.halfYearHint"), price: tr("billing.p.halfYearPrice") },
    monthly: { name: tr("billing.month"), hint: tr("billing.p.monthHint"), price: tr("billing.p.monthPrice") },
  };

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post("/billing/paddle/checkout", { plan: planId });
      setCheckout(null, result.orderId);
      await openPaddleCheckout({
        clientToken: result.clientToken,
        environment: result.environment,
        transactionId: result.transactionId,
        email: result.email,
        uiLanguage: language,
        onEvent: (event) => {
          if (event?.name === "checkout.completed") {
            closePaddleCheckout();
            setScreen("checkout_return");
          }
        },
      });
    } catch (err) {
      if (err?.status === 409) { setError("already"); refresh(); }
      else if (err?.status === 503) setError("unavailable");
      else if (err?.message === "paddle_unavailable") setError("load");
      else setError("generic");
    } finally {
      setBusy(false);
    }
  }

  async function portal(which) {
    setError(null);
    try { await openPortalLink(which); } catch { setError("portal"); }
  }

  async function resume() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/billing/resume", {});
      await refresh();
    } catch {
      setError("resume");
    } finally {
      setBusy(false);
    }
  }

  const view = subscriptionView(subscription);
  const provider = subscription?.provider;
  const errorText = error && {
    already: tr("billing.p.alreadySubscribed"),
    unavailable: tr("billing.p.unavailable"),
    load: tr("billing.p.loadFailed"),
    generic: tr("billing.p.unavailable"),
    portal: tr("billing.p.portalFailed"),
    resume: tr("billing.p.resumeFailed"),
  }[error];

  return (
    <div className="screen subscription-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">{tr("account.subscription")}</h1>
      </div>

      <div className="subscription-body">
        {view === "active" && (
          <>
            <div className="subscription-status">
              <span className="subscription-status__label">{tr("billing.p.subLabel", { plan: getPlanLabel(provider.plan) })}</span>
              <span className="subscription-status__value">{tr("billing.p.active")}</span>
              <span className="subscription-status__hint">{tr("billing.p.renewsOn", { date: formatPeriodEnd(provider.currentPeriodEnd) })}</span>
            </div>
            <div className="subscription-manage">
              <ManageRow label={tr("billing.p.card")} hint={tr("billing.p.cardHint")} onClick={() => portal("updatePaymentMethodUrl")} />
              <ManageRow label={tr("billing.p.changePlan")} hint={tr("billing.p.changePlanHint")} onClick={() => portal("overviewUrl")} />
              <ManageRow label={tr("billing.p.invoices")} onClick={() => portal("overviewUrl")} />
              <ManageRow label={tr("billing.p.cancel")} hint={tr("billing.p.cancelHint", { date: formatPeriodEnd(provider.currentPeriodEnd) })} onClick={() => portal("cancelUrl")} />
            </div>
            <p className="subscription-manage__note">{tr("billing.p.portalNote")}</p>
          </>
        )}

        {view === "canceled" && (
          <div className="subscription-status">
            <span className="subscription-status__label">{tr("billing.p.subLabel", { plan: getPlanLabel(provider.plan) })}</span>
            <span className="subscription-status__value">{tr("billing.p.canceled", { date: formatPeriodEnd(provider.scheduledCancelAt) })}</span>
            <span className="subscription-status__hint">{tr("billing.p.canceledHint")}</span>
          </div>
        )}

        {view === "past_due" && (
          <div className="subscription-status subscription-status--warn">
            <span className="subscription-status__label">{tr("billing.p.actionNeeded")}</span>
            <span className="subscription-status__value">{tr("billing.p.pastDue")}</span>
            <span className="subscription-status__hint">
              {provider.graceUntil ? tr("billing.p.pastDueHint", { date: formatPeriodEnd(provider.graceUntil) }) : tr("billing.p.pastDueHintNoDate")}
            </span>
          </div>
        )}

        {view === "plans" && (
          <PlanPicker
            tr={tr}
            subscription={subscription}
            plans={plans}
            planId={planId}
            onPick={(id) => { setPlanId(id); setError(null); }}
            sandbox={paddleStatus?.environment === "sandbox"}
          />
        )}

        {errorText && <p className="subscription-error" role="alert">{errorText}</p>}
      </div>

      <div className="subscription-footer">
        {view === "plans" && (
          <>
            <p className="subscription-disclaimer">
              {subscription?.plan === "trial" ? `${tr("billing.p.renewNote")} ${tr("billing.p.trialNote")}` : tr("billing.p.renewNote")}
            </p>
            <button
              type="button"
              className="btn btn-primary subscription-cta"
              disabled={busy || !paddleStatus?.enabled}
              onClick={subscribe}
            >
              {busy ? tr("billing.p.opening") : tr("billing.p.subscribe", { price: plans[planId].price })}
            </button>
            {paddleStatus && !paddleStatus.enabled && <p className="subscription-summary__note">{tr("billing.p.unavailable")}</p>}
          </>
        )}
        {view === "canceled" && (
          <button type="button" className="btn btn-primary subscription-cta" disabled={busy} onClick={resume}>{tr("billing.p.resume")}</button>
        )}
        {view === "past_due" && (
          <button type="button" className="btn btn-primary subscription-cta" onClick={() => portal("updatePaymentMethodUrl")}>{tr("billing.p.updateCard")}</button>
        )}
      </div>
    </div>
  );
}

function ManageRow({ label, hint, onClick }) {
  return (
    <button type="button" className="subscription-manage__row" onClick={onClick}>
      <span className="subscription-manage__text">
        <span className="subscription-manage__label">{label}</span>
        {hint && <span className="subscription-manage__hint">{hint}</span>}
      </span>
      <span className="subscription-manage__chevron" aria-hidden="true">›</span>
    </button>
  );
}

function PlanPicker({ tr, subscription, plans, planId, onPick, sandbox }) {
  const unlimited = isUnlimitedPlan(subscription?.plan);
  const remaining = subscription && !unlimited ? daysLeft(subscription.currentPeriodEnd) : null;
  return (
    <>
      <div className={`subscription-status${subscription ? "" : " subscription-status--none"}`}>
        <span className="subscription-status__label">{tr("billing.access")}</span>
        {unlimited ? (
          <>
            <span className="subscription-status__value">{tr("billing.unlimited")}</span>
            <span className="subscription-status__hint">{tr("billing.p.unlimitedPreview")}</span>
          </>
        ) : subscription?.plan === "trial" ? (
          <>
            <span className="subscription-status__value">{tr("billing.p.trialUntil", { date: formatPeriodEnd(subscription.currentPeriodEnd) })}</span>
            <span className="subscription-status__hint">{remaining > 0 ? tr("billing.daysLeft", { count: remaining }) : tr("billing.endsToday")}</span>
          </>
        ) : subscription ? (
          <>
            <span className="subscription-status__value">{tr("billing.until", { plan: getPlanLabel(subscription.plan), date: formatPeriodEnd(subscription.currentPeriodEnd) })}</span>
            <span className="subscription-status__hint">{remaining > 0 ? tr("billing.daysLeft", { count: remaining }) : tr("billing.endsToday")}</span>
          </>
        ) : (
          <>
            <span className="subscription-status__value">{tr("billing.noAccess")}</span>
            <span className="subscription-status__hint">{tr("billing.noAccessHelp")}</span>
          </>
        )}
      </div>

      <div className="subscription-lead">
        <p className="subscription-lead__eyebrow">{tr("account.subscription")}</p>
        <h2 className="subscription-lead__title">{tr("billing.p.lead")}</h2>
      </div>

      <div className="plan-list" role="radiogroup">
        {PLAN_ORDER.map((id) => {
          const p = plans[id];
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={id === planId}
              className={`plan${id === planId ? " plan--selected" : ""}`}
              onClick={() => onPick(id)}
            >
              {p.badge && <span className="plan__badge">{p.badge}</span>}
              <span className="plan__radio" />
              <span className="plan__info">
                <span className="plan__name">{p.name}</span>
                <span className="plan__hint">{p.hint}</span>
              </span>
              <span className="plan__price">{p.price}</span>
            </button>
          );
        })}
      </div>

      {sandbox && <p className="subscription-sandbox-note">{tr("billing.p.sandbox")}</p>}
    </>
  );
}
