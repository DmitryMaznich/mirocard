import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";

export default function CheckoutRedirectScreen() {
  const checkoutUrl = useAppStore((s) => s.checkoutUrl);
  const setScreen = useAppStore((s) => s.setScreen);

  useEffect(() => {
    if (!checkoutUrl) return;
    const timer = setTimeout(() => {
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      setScreen("checkout_return");
    }, 600); // brief pause so the "Открываем..." message is actually readable
    return () => clearTimeout(timer);
  }, [checkoutUrl, setScreen]);

  return (
    <div className="screen checkout-transition-screen">
      <div className="screen-header">
        <button className="back-btn back-btn--disabled" disabled><BackArrowIcon /></button>
      </div>
      <div className="checkout-transition__center">
        <div className="checkout-spinner" />
        <div>
          <div className="checkout-transition__title">Открываем страницу оплаты…</div>
          <div className="checkout-transition__sub">Сейчас откроется защищённая<br />страница платёжного провайдера.</div>
        </div>
        <div className="checkout-lock-note">Данные карты нам не передаются</div>
      </div>
    </div>
  );
}
