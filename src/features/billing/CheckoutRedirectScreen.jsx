import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";

// The checkout tab was already opened (and redirected to the real
// checkoutUrl) synchronously inside SubscriptionScreen's click handler --
// see its own comment for why that has to happen there, not here, to
// survive iOS Safari's popup blocker. This screen is just a brief,
// reassuring transition before the status-poll screen, plus an explicit
// fallback in case that auto-open was blocked or the tab got closed.
export default function CheckoutRedirectScreen() {
  const checkoutUrl = useAppStore((s) => s.checkoutUrl);
  const setScreen = useAppStore((s) => s.setScreen);

  useEffect(() => {
    const timer = setTimeout(() => setScreen("checkout_return"), 900);
    return () => clearTimeout(timer);
  }, [setScreen]);

  function openManually() {
    if (checkoutUrl) window.open(checkoutUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="screen checkout-transition-screen">
      <div className="screen-header">
        <button className="back-btn back-btn--disabled" disabled><BackArrowIcon /></button>
      </div>
      <div className="checkout-transition__center">
        <div className="checkout-spinner" />
        <div>
          <div className="checkout-transition__title">Открываем страницу оплаты…</div>
          <div className="checkout-transition__sub">Если страница оплаты не открылась<br />в новой вкладке, нажмите кнопку ниже.</div>
        </div>
        <div className="checkout-lock-note">Данные карты нам не передаются</div>
      </div>
      <div className="subscription-footer">
        <button type="button" className="btn btn-secondary" disabled={!checkoutUrl} onClick={openManually}>
          Открыть оплату
        </button>
      </div>
    </div>
  );
}
