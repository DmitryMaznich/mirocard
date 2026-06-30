import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { api, setApiToken } from "@/core/api";
import { getDb } from "@/core/db";
import { persistBootstrap, applyBootstrapToStore } from "@/core/bootstrap";
import Button from "@/shared/components/Button";

export default function VerifyEmailScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const token = useAppStore((s) => s.verifyEmailToken);

  const [status, setStatus] = useState("loading"); // loading | success | error

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

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
        <div className="auth-logo">Mirocard</div>
        <div className="auth-form" style={{ textAlign: "center" }}>
          Подтверждаем email…
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="auth-screen">
        <div className="auth-logo">Mirocard</div>
        <div className="auth-form" style={{ textAlign: "center", gap: 20 }}>
          <p style={{ fontSize: "1.1rem", color: "#4a9b8f", fontWeight: 600 }}>
            Email подтверждён!
          </p>
          <Button onClick={() => setScreen("home")} fullWidth>
            Перейти в приложение
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">Mirocard</div>
      <div className="auth-form" style={{ textAlign: "center", gap: 20 }}>
        <p style={{ color: "#c0392b" }}>
          Ссылка недействительна или срок её действия истёк.
        </p>
        <Button onClick={() => setScreen("verify_email_sent")} fullWidth variant="secondary">
          Запросить новую ссылку
        </Button>
        <button className="auth-link" onClick={() => setScreen("login")}>
          Вернуться к входу
        </button>
      </div>
    </div>
  );
}
