import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { getPlanLabel, formatPeriodEnd, daysLeft, isUnlimitedPlan } from "./planLabels";
import { PAID_PLANS_PAUSED } from "./entitlement";



// Pre-contract consent text is offered in Slovenian too (ZVPot-1: consumer
// dealings in Slovenia must be available in Slovenian). The consent selector
// is independent of the interface language. Its locale is sent with checkout, stored on the
// consent row, and decides the purchase-confirmation email's language.
const CONSENT_TEXT = {
  ru: {
    planNames: { monthly: "Месяц", half_year: "Полгода", annual: "Год" },
    terms: (link) => <>Я принимаю {link("/terms", "Условия использования")}</>,
    price: (price, planName) => `Подтверждаю цену ${price} и период доступа «${planName}»`,
    digital: (link) => <>Прошу открыть доступ сразу после оплаты и понимаю, что с этого момента теряю право на отказ от покупки в течение 14 дней (см. {link("/refunds", "Возврат средств")})</>,
    disclaimer: (planName) => `Разовая оплата за «${planName}». Без автосписаний — карта не сохраняется, по истечении периода доступ закончится, продлить можно будет вручную в любой момент.`,
  },
  sl: {
    planNames: { monthly: "Mesec", half_year: "Pol leta", annual: "Leto" },
    terms: (link) => <>Sprejemam {link("/sl/terms", "Splošne pogoje uporabe")}</>,
    price: (price, planName) => `Potrjujem ceno ${price} in obdobje dostopa »${planName}«`,
    digital: (link) => <>Prosim za dostop takoj po plačilu in se zavedam, da s tem izgubim pravico do odstopa od pogodbe v 14 dneh (glejte {link("/sl/refunds", "Vračilo kupnine")})</>,
    disclaimer: (planName) => `Enkratno plačilo za »${planName}«. Brez samodejnih bremenitev — kartica se ne shrani, po izteku obdobja se dostop zaključi, podaljšate ga lahko ročno kadar koli.`,
  },
};

function legalLink(href, label) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>;
}

function formatMinor(amountMinor) {
  return (amountMinor / 100).toFixed(2).replace(".", ",");
}

export default function SubscriptionScreen() {
  return PAID_PLANS_PAUSED ? <FreeForNowScreen /> : <PaidPlansScreen />;
}

// Every path that still leads here (a ?plan= link, a locked topic, the checkout-return screen)
// lands on this note while paid plans are paused, so nobody can pay for nothing.
function FreeForNowScreen() {
  const { t: tr } = useUiTranslation();
  const setScreen = useAppStore((s) => s.setScreen);
  const setPendingCheckoutPlan = useAppStore((s) => s.setPendingCheckoutPlan);
  useEffect(() => { setPendingCheckoutPlan?.(null); }, [setPendingCheckoutPlan]);
  return (
    <div className="screen subscription-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">{tr("account.subscription")}</h1>
      </div>
      <div className="subscription-body">
        <div className="subscription-status">
          <span className="subscription-status__label">{tr("billing.freeTitle")}</span>
          <span className="subscription-status__value">{tr("billing.freeValue")}</span>
        </div>
        <p className="subscription-free-note">{tr("billing.freeNote")}</p>
      </div>
    </div>
  );
}

function PaidPlansScreen() {
  const { t: tr, language } = useUiTranslation();
  const PLANS = [
    { id: "monthly", name: tr("billing.month"), hint: tr("billing.monthHint"), priceLabel: "€ 9,90" },
    { id: "half_year", name: tr("billing.halfYear"), hint: tr("billing.halfYearHint"), priceLabel: "€ 49,90" },
    { id: "annual", name: tr("billing.year"), hint: tr("billing.yearHint"), priceLabel: "€ 89,90" },
  ];

  const pendingCheckoutPlan = useAppStore((s) => s.pendingCheckoutPlan);
  const subscription = useAppStore((s) => s.subscription);
  const setScreen = useAppStore((s) => s.setScreen);
  const setCheckout = useAppStore((s) => s.setCheckout);

  const [planId, setPlanId] = useState(pendingCheckoutPlan ?? "annual");
  const [method, setMethod] = useState("card");
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoResult, setPromoResult] = useState(null); // { ok, kind, discountedAmountMinor, ... }
  const [promoError, setPromoError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pricePeriodConfirmed, setPricePeriodConfirmed] = useState(false);
  const [digitalContentAck, setDigitalContentAck] = useState(false);
  const [consentLocale, setConsentLocale] = useState(language);
  // Two steps: "choose" shows the current access and the plans; payment
  // method, promo-discounted total and the legal consents only appear on
  // "pay", after the user deliberately moves on to paying.
  const [step, setStep] = useState("choose");
  // While the server refuses checkout (legal docs still "draft"), don't walk a
  // parent through the whole form into a 503 -- say payment is coming and
  // leave the promo code as the way in. Fails open: an unreachable status
  // endpoint keeps the normal button (the server still guards checkout).
  const [checkoutEnabled, setCheckoutEnabled] = useState(true);
  useEffect(() => {
    let alive = true;
    api.get("/auth/signup-status")
      .then((s) => { if (alive && s?.checkoutEnabled === false) setCheckoutEnabled(false); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const plan = PLANS.find((p) => p.id === planId);
  const discounted = promoResult?.ok && promoResult.kind !== "free_grant" ? promoResult.discountedAmountMinor : null;
  const consentsGiven = termsAccepted && pricePeriodConfirmed && digitalContentAck;
  const ct = CONSENT_TEXT[consentLocale];
  const consentPlanName = ct.planNames[plan.id];
  const priceText = discounted != null ? `€ ${formatMinor(discounted)}` : plan.priceLabel;

  // Consent is only valid in the wording the customer actually saw, so
  // switching language clears any boxes ticked in the other one.
  function switchConsentLocale(next) {
    if (next === consentLocale) return;
    setConsentLocale(next);
    setTermsAccepted(false);
    setPricePeriodConfirmed(false);
    setDigitalContentAck(false);
  }

  async function applyPromo() {
    setPromoError(null);
    const result = await api.post("/billing/validate-code", { code: promoInput, plan: planId });
    if (!result.ok) {
      setPromoResult(null);
      setPromoError(result.reason);
      return;
    }
    setPromoResult(result);
    if (result.kind === "free_grant") {
      const redeem = await api.post("/billing/redeem-code", { code: result.code });
      if (redeem.ok) {
        // A free-grant redemption completes synchronously server-side --
        // there's no order to poll. Clear checkoutOrderId (it may still
        // hold a stale value from an earlier, unrelated real-checkout
        // attempt this session) so CheckoutReturnScreen reads the current
        // subscription once instead of polling the wrong order's status.
        setCheckout(null, null);
        setScreen("checkout_return");
      }
    }
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);

    // Must open synchronously, right here in the click handler, before any
    // `await` -- iOS Safari (and other strict popup blockers) only allow
    // window.open() through as a direct result of a user gesture; calling
    // it later, after the checkout-session API call resolves, is exactly
    // what used to get silently blocked. Opening a blank tab now and
    // redirecting it once the real checkout URL comes back keeps it
    // inside that gesture without making the user stare at a blank tab
    // any longer than the API call itself takes.
    const checkoutWindow = window.open("", "_blank", "noopener,noreferrer");

    try {
      const code = promoResult?.ok && promoResult.kind !== "free_grant" ? promoResult.code : null;
      const result = await api.post("/billing/checkout", {
        plan: planId, method, code,
        consents: { termsAccepted, pricePeriodConfirmed, digitalContentAck },
        locale: consentLocale,
      });
      setCheckout(result.checkoutUrl, result.orderId);
      if (checkoutWindow && !checkoutWindow.closed) {
        checkoutWindow.location.href = result.checkoutUrl;
      }
      setScreen("checkout_redirect");
    } catch (err) {
      if (checkoutWindow && !checkoutWindow.closed) checkoutWindow.close();
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const unlimited = isUnlimitedPlan(subscription?.plan);
  const remaining = subscription && !unlimited ? daysLeft(subscription.currentPeriodEnd) : null;

  if (step === "pay") {
    return (
      <div className="screen subscription-screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setStep("choose")} aria-label={tr("billing.backToPlans")}><BackArrowIcon /></button>
          <h1 className="screen-title">{tr("billing.payment")}</h1>
        </div>

        <div className="subscription-body">
          <div className="subscription-summary">
            <span className="subscription-summary__plan">{plan.name}</span>
            <span className="subscription-summary__price">{priceText}</span>
          </div>
          {subscription && !unlimited && (
            <p className="subscription-summary__note">{tr("billing.extendsAfter", { date: formatPeriodEnd(subscription.currentPeriodEnd) })}</p>
          )}

          <p className="section-label">{tr("billing.method")}</p>
          <div className="pay-methods">
            <button type="button" className={`pay-chip${method === "card" ? " pay-chip--selected" : ""}`} onClick={() => setMethod("card")}>{tr("billing.card")}</button>
            {/* Launch is EU/Stripe only. МИР/СБП (Lava Top) is shown disabled
                to signal it's planned, not forgotten; the server refuses it
                too (DISABLED_CHECKOUT_METHODS in backend/server.mjs). */}
            <button type="button" className="pay-chip pay-chip--disabled" disabled aria-disabled="true" title={tr("topics.soon")}>
              МИР / СБП
              <span className="pay-chip__soon">{tr("billing.soonLower")}</span>
            </button>
          </div>

          <div className="subscription-consents" lang={consentLocale}>
            <div className="consent-lang" role="group" aria-label="Язык условий / Jezik pogojev">
              <button type="button" className={`consent-lang__btn${consentLocale === "ru" ? " consent-lang__btn--active" : ""}`} aria-pressed={consentLocale === "ru"} onClick={() => switchConsentLocale("ru")}>Русский</button>
              <button type="button" className={`consent-lang__btn${consentLocale === "sl" ? " consent-lang__btn--active" : ""}`} aria-pressed={consentLocale === "sl"} onClick={() => switchConsentLocale("sl")}>Slovenščina</button>
            </div>
            <label className="subscription-consent">
              <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
              <span>{ct.terms(legalLink)}</span>
            </label>
            <label className="subscription-consent">
              <input type="checkbox" checked={pricePeriodConfirmed} onChange={(e) => setPricePeriodConfirmed(e.target.checked)} />
              <span>{ct.price(priceText, consentPlanName)}</span>
            </label>
            <label className="subscription-consent">
              <input type="checkbox" checked={digitalContentAck} onChange={(e) => setDigitalContentAck(e.target.checked)} />
              <span>{ct.digital(legalLink)}</span>
            </label>
          </div>

          {submitError && <p className="subscription-error">{submitError}</p>}
        </div>

        <div className="subscription-footer">
          {/* M0 launch: a single prepaid-period purchase, not a recurring
              subscription -- no card is kept on file and nothing charges
              again automatically. Said explicitly here rather than only in
              the Terms. See docs/commercial-launch-runbook.md's M0/M1 section. */}
          <p className="subscription-disclaimer" lang={consentLocale}>
            {ct.disclaimer(consentPlanName)}
          </p>
          <button type="button" className="btn btn-primary subscription-cta" disabled={submitting || !consentsGiven} onClick={submit}>
            {tr("billing.payAmount", { price: priceText })}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen subscription-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">{tr("account.subscription")}</h1>
      </div>

      <div className="subscription-body">
        <div className={`subscription-status${subscription ? "" : " subscription-status--none"}`}>
          <span className="subscription-status__label">{tr("billing.access")}</span>
          {unlimited ? (
            <>
              <span className="subscription-status__value">{tr("billing.unlimited")}</span>
              <span className="subscription-status__hint">{tr("billing.unlimitedHelp")}</span>
            </>
          ) : subscription ? (
            <>
              <span className="subscription-status__value">
                {tr("billing.until", { plan: getPlanLabel(subscription.plan), date: formatPeriodEnd(subscription.currentPeriodEnd) })}
              </span>
              <span className="subscription-status__hint">
                {remaining > 0 ? tr("billing.daysLeft", { count: remaining }) : tr("billing.endsToday")}
              </span>
            </>
          ) : (
            <>
              <span className="subscription-status__value">{tr("billing.noAccess")}</span>
              <span className="subscription-status__hint">{tr("billing.noAccessHelp")}</span>
            </>
          )}
        </div>

        {!unlimited && (
          <>
            <div className="subscription-lead">
              <p className="subscription-lead__eyebrow">{subscription ? tr("billing.renew") : tr("billing.purchase")}</p>
              <h2 className="subscription-lead__title">{tr("billing.allLessons")}</h2>
            </div>

            <div className="plan-list">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`plan${p.id === planId ? " plan--selected" : ""}`}
                  onClick={() => { setPlanId(p.id); setPromoResult(null); }}
                >
                  <span className="plan__radio" />
                  <span className="plan__info">
                    <span className="plan__name">{p.name}</span>
                    <span className="plan__hint">{p.hint}</span>
                  </span>
                  <span className="plan__price">{p.priceLabel}</span>
                </button>
              ))}
            </div>

            {!promoOpen && (
              <button type="button" className="promo-toggle" onClick={() => setPromoOpen(true)}>{tr("billing.havePromo")}</button>
            )}
            {promoOpen && (
              <div className="promo-row">
                <input className="promo-input" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} placeholder={tr("billing.promo")} />
                <button type="button" className="promo-apply" onClick={applyPromo}>{tr("billing.apply")}</button>
                {promoError && <span className="promo-error">{tr("billing.invalidCode")}</span>}
              </div>
            )}
          </>
        )}
      </div>

      {!unlimited && (
        <div className="subscription-footer">
          {checkoutEnabled ? (
            <button type="button" className="btn btn-primary subscription-cta" onClick={() => setStep("pay")}>
              {tr("billing.proceedAmount", { price: priceText })}
            </button>
          ) : (
            <>
              <p className="subscription-summary__note">{tr("billing.paymentSoonHelp")}</p>
              <button type="button" className="btn btn-primary subscription-cta" disabled>{tr("billing.paymentSoon")}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
