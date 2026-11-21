import MironiumLogo from "@/shared/components/MironiumLogo";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { api, setApiToken } from "@/core/api";
import { getDb } from "@/core/db";
import { persistBootstrap, applyBootstrapToStore } from "@/core/bootstrap";
import Button from "@/shared/components/Button";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";

export default function VerifyEmailScreen() {
  const { t } = useUiTranslation();
  const setScreen = useAppStore((s) => s.setScreen);
  const token = useAppStore((s) => s.verifyEmailToken);

  const verificationStarted = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | success | error

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    // The server consumes this token once. Do not repeat the request when
    // React StrictMode replays the effect during development.
    if (verificationStarted.current === token) return;
    verificationStarted.current = token;

    async function verify() {
      try {
        const { account, settings, token: authToken } = await api.get(
          `/auth/verify-email?token=${encodeURIComponent(token)}`
        );
        setApiToken(authToken);

        const [bootstrap, sessionsRaw] = await Promise.all([
          api.get("/account/bootstrap"),
          api.get("/sessions?limit=200"),
        ]);

        const payload = {
          token: authToken,
          account,
          builtinVisibility: bootstrap.builtinVisibility ?? {},
          archivedTopicIds: bootstrap.archivedTopicIds ?? [],
          erasedStudentIds: bootstrap.erasedStudentIds ?? [],
          subscription: bootstrap.subscription ?? null,
          settings: settings ?? bootstrap.settings,
          students: bootstrap.students,
          ownedTopics: bootstrap.ownedTopics,
          studentTopicLinks: bootstrap.studentTopicLinks,
          conceptProgress: bootstrap.conceptProgress,
          sessions: sessionsRaw,
        };

        const db = await getDb();
        await persistBootstrap(db, payload);
        applyBootstrapToStore(payload);
        setStatus("success");
      } catch {
        setStatus("error");
      }
    }

    verify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (status === "loading") {
    return (
      <div className="auth-screen">
        <MironiumLogo className="auth-logo" />
        <div className="auth-form" style={{ textAlign: "center" }}>
          {t("auth.verifying")}
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="auth-screen">
        <MironiumLogo className="auth-logo" />
        <div className="auth-form" style={{ textAlign: "center", gap: 20 }}>
          <p style={{ fontSize: "1.1rem", color: "#4a9b8f", fontWeight: 600 }}>
            {t("auth.verified")}
          </p>
          <Button onClick={() => setScreen("home")} fullWidth>
            {t("auth.openApp")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <MironiumLogo className="auth-logo" />
      <div className="auth-form" style={{ textAlign: "center", gap: 20 }}>
        <p style={{ color: "#c0392b" }}>
          {t("auth.linkInvalid")}
        </p>
        <Button onClick={() => setScreen("verify_email_sent")} fullWidth variant="secondary">
          {t("auth.requestNewLink")}
        </Button>
        <button className="auth-link" onClick={() => setScreen("login")}>
          {t("auth.backToLogin")}
        </button>
      </div>
    </div>
  );
}
