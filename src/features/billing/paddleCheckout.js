// Paddle.js (Paddle Billing v2) overlay checkout. Loaded only when a parent
// presses «Оформить» on the subscription screen -- never on app start.
// The transaction itself is created by our server (POST
// /billing/paddle/checkout), so the client can't pick the price or the
// account it pays for; Paddle.js only shows the payment form for it.

const PADDLE_JS_URL = "https://cdn.paddle.com/paddle/v2/paddle.js";

let loading = null;
let initializedFor = null;
// Paddle.Initialize can run only once per page, so its eventCallback stays
// fixed; the handler of the checkout currently open is swapped in here.
let currentHandler = null;

export function loadPaddle() {
  if (typeof window !== "undefined" && window.Paddle) return Promise.resolve(window.Paddle);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PADDLE_JS_URL;
      script.async = true;
      script.onload = () => (window.Paddle ? resolve(window.Paddle) : reject(new Error("paddle_unavailable")));
      script.onerror = () => {
        loading = null; // let the next press try again (blocked network, ad blocker)
        reject(new Error("paddle_unavailable"));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

// Paddle's checkout speaks Russian; for any other interface language (Slovenian
// is not among Paddle's checkout languages) it falls back to English.
export function paddleLocale(uiLanguage) {
  return uiLanguage === "ru" ? "ru" : "en";
}

/**
 * Opens the overlay for a server-created transaction.
 * onEvent receives Paddle's checkout events ({ name: "checkout.completed" | "checkout.closed" | … }).
 */
export async function openPaddleCheckout({ clientToken, environment, transactionId, email, uiLanguage, onEvent }) {
  const Paddle = await loadPaddle();
  currentHandler = onEvent ?? null;
  const key = `${environment}:${clientToken}`;
  if (initializedFor !== key) {
    if (environment === "sandbox") Paddle.Environment.set("sandbox");
    Paddle.Initialize({ token: clientToken, eventCallback: (event) => currentHandler?.(event) });
    initializedFor = key;
  }
  Paddle.Checkout.open({
    transactionId,
    ...(email ? { customer: { email } } : {}),
    settings: { displayMode: "overlay", theme: "light", locale: paddleLocale(uiLanguage), allowLogout: false },
  });
}

export function closePaddleCheckout() {
  try { window.Paddle?.Checkout?.close(); } catch { /* already closed */ }
  currentHandler = null;
}

// Test hook: forget the loaded/initialized state between tests.
export function resetPaddleForTests() {
  loading = null;
  initializedFor = null;
  currentHandler = null;
}
