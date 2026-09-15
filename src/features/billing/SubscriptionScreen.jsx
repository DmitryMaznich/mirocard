import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";

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

  const plan = PLANS.find((p) => p.id === planId);
  const discounted = promoResult?.ok && promoResult.kind !== "free_grant" ? promoResult.discountedAmountMinor : null;

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
      if (redeem.ok) setScreen("checkout_return");
    }
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const code = promoResult?.ok && promoResult.kind !== "free_grant" ? promoResult.code : null;
      const result = await api.post("/billing/checkout", { plan: planId, method, code });
      setCheckout(result.checkoutUrl, result.orderId);
      setScreen("checkout_redirect");
    } catch (err) {
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

        {submitError && <p className="subscription-error">{submitError}</p>}
      </div>

      <div className="subscription-footer">
        <button type="button" className="btn btn-primary subscription-cta" disabled={submitting} onClick={submit}>
          Оформить — {discounted != null ? `€ ${formatMinor(discounted)}` : plan.priceLabel}
        </button>
      </div>
    </div>
  );
}
