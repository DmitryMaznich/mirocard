import { useEffect, useRef, useState } from "react";

const GIS_SRC = "https://accounts.google.com/gsi/client";

function loadGis(locale) {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${GIS_SRC}?hl=${locale}`;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Redirect mode only: Google posts the ID token to our backend, which sends
// the browser back with a one-time code (see backend handleGoogleCallback).
// Popups are unreliable in the iOS home-screen PWA, so there is one path.
export default function GoogleSignInButton({ clientId, text = "signin_with", locale = "ru" }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadGis(locale)
      .then(() => {
        if (!alive || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: "redirect",
          login_uri: `${window.location.origin}/api/auth/google/callback`,
        });
        ref.current.replaceChildren();
        window.google.accounts.id.renderButton(ref.current, {
          type: "standard", theme: "outline", size: "large", text, shape: "pill", width: 300, locale,
        });
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [clientId, text, locale]);

  if (failed) return null;
  return <div className="google-signin" ref={ref} />;
}
