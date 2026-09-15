import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 20000;

export default function CheckoutReturnScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const [subscription, setSubscription] = useState(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      let result = null;
      try {
        result = await api.get("/billing/subscription");
      } catch {
        // A transient network error or an expired token shouldn't stall the
        // screen on an unhandled rejection — just keep polling until the
        // timeout, same as "not active yet".
      }
      if (cancelled) return;
      if (result?.status === "active") {
        setSubscription(result);
        return;
      }
      if (Date.now() - startedAt.current < POLL_TIMEOUT_MS) {
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    }
    poll();
    return () => { cancelled = true; };
  }, []);

  const processing = !subscription;

  return (
    <div className="screen checkout-transition-screen">
      <div className="screen-header">
        <button className="back-btn back-btn--disabled" disabled><BackArrowIcon /></button>
      </div>
      <div className="checkout-transition__center">
        {processing ? (
          <>
            <div className="checkout-spinner" />
            <div>
              <div className="checkout-return__title">Обрабатываем оплату…</div>
              <div className="checkout-transition__sub">Обычно это занимает несколько<br />секунд. Не закрывайте приложение.</div>
            </div>
          </>
        ) : (
          <>
            <div className="checkout-return__check">✓</div>
            <div>
              <div className="checkout-return__title">Подписка активна!</div>
              <div className="checkout-transition__sub">{planLabel(subscription.plan)} · действует до {formatDate(subscription.currentPeriodEnd)}</div>
            </div>
          </>
        )}
      </div>
      {!processing && (
        <div className="subscription-footer">
          <button type="button" className="btn btn-primary" onClick={() => setScreen("home")}>Начать заниматься</button>
        </div>
      )}
    </div>
  );
}

function planLabel(plan) {
  return { monthly: "Месяц", half_year: "Полгода", annual: "Год", free_grant: "Бесплатный доступ" }[plan] ?? plan;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" });
}
