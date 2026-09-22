import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { PLAN_LABELS, formatPeriodEnd } from "./planLabels";

const PLANS = [
  { id: "monthly", name: "Месяц", hint: "Без долгих обязательств", priceLabel: "€ 9,90" },
  { id: "half_year", name: "Полгода", hint: "€ 8,32 в месяц · выгода 16%", priceLabel: "€ 49,90" },
  { id: "annual", name: "Год", hint: "€ 7,49 в месяц · максимальная выгода", priceLabel: "€ 89,90" },
];

function formatMinor(amountMinor) {
  return (amountMinor / 100).toFixed(2).replace(".", ",");
}

export default function SubscriptionScreen() {
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

  const plan = PLANS.find((p) => p.id === planId);
  const discounted = promoResult?.ok && promoResult.kind !== "free_grant" ? promoResult.discountedAmountMinor : null;
  const consentsGiven = termsAccepted && pricePeriodConfirmed && digitalContentAck;

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

  return (
    <div className="screen subscription-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">Подписка</h1>
      </div>

      <div className="subscription-body">
        {subscription && (
          <div className="subscription-status">
            <span className="subscription-status__label">Текущий план</span>
            <span className="subscription-status__value">
              {PLAN_LABELS[subscription.plan] ?? subscription.plan} · до {formatPeriodEnd(subscription.currentPeriodEnd)}
            </span>
          </div>
        )}

        <div className="subscription-lead">
          <p className="subscription-lead__eyebrow">Оформление</p>
          <h2 className="subscription-lead__title">Все занятия — в одной подписке</h2>
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

        <p className="section-label">Способ оплаты</p>
        <div className="pay-methods">
          <button type="button" className={`pay-chip${method === "card" ? " pay-chip--selected" : ""}`} onClick={() => setMethod("card")}>Картой</button>
          <button type="button" className={`pay-chip${method === "mir_sbp" ? " pay-chip--selected" : ""}`} onClick={() => setMethod("mir_sbp")}>МИР / СБП</button>
        </div>

        {!promoOpen && (
          <button type="button" className="promo-toggle" onClick={() => setPromoOpen(true)}>У меня есть промокод</button>
        )}
        {promoOpen && (
          <div className="promo-row">
            <input className="promo-input" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} placeholder="ПРОМОКОД" />
            <button type="button" className="promo-apply" onClick={applyPromo}>Применить</button>
            {promoError && <span className="promo-error">Код не подходит</span>}
          </div>
        )}

        <div className="subscription-consents">
          <label className="subscription-consent">
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
            <span>Я принимаю <a href="/terms" target="_blank" rel="noopener noreferrer">Условия использования</a></span>
          </label>
          <label className="subscription-consent">
            <input type="checkbox" checked={pricePeriodConfirmed} onChange={(e) => setPricePeriodConfirmed(e.target.checked)} />
            <span>Подтверждаю цену {discounted != null ? `€ ${formatMinor(discounted)}` : plan.priceLabel} и период доступа «{plan.name}»</span>
          </label>
          <label className="subscription-consent">
            <input type="checkbox" checked={digitalContentAck} onChange={(e) => setDigitalContentAck(e.target.checked)} />
            <span>Согласен(на) на немедленное предоставление цифрового контента после оплаты — это может ограничить моё право на отказ от покупки (см. <a href="/refunds" target="_blank" rel="noopener noreferrer">Возврат средств</a>)</span>
          </label>
        </div>

        {submitError && <p className="subscription-error">{submitError}</p>}
      </div>

      <div className="subscription-footer">
        {/* M0 launch: this is a single prepaid-period purchase, not a
            recurring subscription -- no card is kept on file and nothing
            charges again automatically. Said explicitly here rather than
            only in the Terms, since "Подписка"/"Оформить" alone could
            otherwise read as an auto-renewing plan. See
            docs/commercial-launch-runbook.md's M0/M1 section. */}
        <p className="subscription-disclaimer">
          Разовая оплата за «{plan.name}». Без автосписаний — карта не сохраняется, по истечении периода доступ закончится, продлить можно будет вручную в любой момент.
        </p>
        <button type="button" className="btn btn-primary subscription-cta" disabled={submitting || !consentsGiven} onClick={submit}>
          Оформить — {discounted != null ? `€ ${formatMinor(discounted)}` : plan.priceLabel}
        </button>
      </div>
    </div>
  );
}
