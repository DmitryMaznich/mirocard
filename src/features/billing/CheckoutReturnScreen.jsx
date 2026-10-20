import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { getPlanLabel, formatPeriodEnd } from "./planLabels";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 20000;
const SUPPORT_EMAIL = "hello@mironium.com";

// "state" is one of:
//   processing -- still polling, within the timeout window
//   success    -- this checkout (or promo redemption) is confirmed
//   failed     -- the order reached a terminal non-success state (refunded/
//                 chargeback/abandoned) -- must never be shown as "active"
//   timeout    -- POLL_TIMEOUT_MS elapsed with no resolution either way
export default function CheckoutReturnScreen() {
  const { t: tr } = useUiTranslation();
  const setScreen = useAppStore((s) => s.setScreen);
  const checkoutOrderId = useAppStore((s) => s.checkoutOrderId);
  const [state, setState] = useState("processing");
  const [result, setResult] = useState(null); // { plan, currentPeriodEnd }
  const [pollToken, setPollToken] = useState(0); // bumped to force a fresh poll cycle
  const startedAtRef = useRef(null);

  const checkNow = useCallback(() => {
    setState("processing");
    setPollToken((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Set here (start of the effect), not at hook-creation time in the
    // render body -- Date.now() is impure and the effect already re-runs
    // exactly once per fresh poll cycle (checkoutOrderId or pollToken
    // changing), which is the right time to mark "a cycle started".
    startedAtRef.current = Date.now();

    async function pollOrderStatus() {
      let order = null;
      try {
        order = await api.get(`/billing/order-status?orderId=${encodeURIComponent(checkoutOrderId)}`);
      } catch {
        // A transient network error or an expired token shouldn't stall the
        // screen on an unhandled rejection -- just keep polling until the
        // timeout, same as "still pending".
      }
      if (cancelled) return;

      if (order?.status === "completed") {
        setResult({ plan: order.plan, currentPeriodEnd: order.currentPeriodEnd });
        setState("success");
        return;
      }
      if (order?.status === "refunded" || order?.status === "chargeback" || order?.status === "abandoned") {
        setState("failed");
        return;
      }
      if (Date.now() - startedAtRef.current < POLL_TIMEOUT_MS) {
        setTimeout(pollOrderStatus, POLL_INTERVAL_MS);
      } else {
        setState("timeout");
      }
    }

    // A promo free-grant redemption (SubscriptionScreen's applyPromo) lands
    // here too, but it already completed synchronously server-side before
    // navigating -- there's no order to poll (checkoutOrderId is cleared
    // for that path specifically so a stale ID from an earlier real
    // checkout attempt can't be polled by mistake). Just read the current
    // subscription once instead.
    async function readCurrentSubscriptionOnce() {
      try {
        const sub = await api.get("/billing/subscription");
        if (cancelled) return;
        if (sub?.status === "active") {
          setResult({ plan: sub.plan, currentPeriodEnd: sub.currentPeriodEnd });
          setState("success");
        } else {
          setState("failed");
        }
      } catch {
        if (!cancelled) setState("failed");
      }
    }

    if (checkoutOrderId) pollOrderStatus();
    else readCurrentSubscriptionOnce();

    return () => { cancelled = true; };
  }, [checkoutOrderId, pollToken]);

  const planLabel = result ? (getPlanLabel(result.plan)) : null;

  return (
    <div className="screen checkout-transition-screen">
      <div className="screen-header">
        <button className="back-btn back-btn--disabled" disabled><BackArrowIcon /></button>
      </div>
      <div className="checkout-transition__center">
        {state === "processing" && (
          <>
            <div className="checkout-spinner" />
            <div>
              <div className="checkout-return__title">{tr("billing.processing")}</div>
              <div className="checkout-transition__sub">{tr("billing.processingHelp")}</div>
            </div>
          </>
        )}

        {state === "success" && (
          <>
            <div className="checkout-return__check">✓</div>
            <div>
              <div className="checkout-return__title">{tr("billing.success")}</div>
              <div className="checkout-transition__sub">{tr("billing.until", { plan: planLabel, date: formatPeriodEnd(result.currentPeriodEnd) })}</div>
            </div>
          </>
        )}

        {(state === "failed" || state === "timeout") && (
          <>
            <div className="checkout-return__title">
              {state === "failed" ? tr("billing.failed") : tr("billing.longCheck")}
            </div>
            <div className="checkout-transition__sub">
              {state === "failed"
                ? tr("billing.failedHelp")
                : tr("billing.retryHelp")}
            </div>
          </>
        )}
      </div>

      <div className="subscription-footer checkout-return__actions">
        {state === "success" && (
          <button type="button" className="btn btn-primary" onClick={() => setScreen("home")}>{tr("billing.start")}</button>
        )}
        {(state === "failed" || state === "timeout") && (
          <>
            {state === "timeout" && (
              <button type="button" className="btn btn-primary" onClick={checkNow}>{tr("billing.check")}</button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setScreen("subscription")}>
              {state === "failed" ? tr("billing.retry") : tr("billing.return")}
            </button>
            <a className="checkout-return__support" href={`mailto:${SUPPORT_EMAIL}`}>{tr("help.contact")}</a>
          </>
        )}
      </div>
    </div>
  );
}
