import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api, setApiToken } from "@/core/api";
import { getDb, kv } from "@/core/db";
import { ApiError } from "@/core/api";
import { persistBootstrap, applyBootstrapToStore, indexStudentTopicLinks, mergeStudents, clearUserIdbData } from "@/core/bootstrap";
import Button from "@/shared/components/Button";

export default function LoginScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setPendingVerificationEmail = useAppStore((s) => s.setPendingVerificationEmail);

  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [showPass,       setShowPass]       = useState(false);
  const [error,          setError]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [showResendHint, setShowResendHint] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { account, token } = await api.post("/auth/login", { email, password });
      setApiToken(token);

      const db = await getDb();

      // Check whether IDB holds data for this same account (offline edits to preserve)
      // or for a different account (stale data that must not leak into this login).
      const storedAccountId = await kv.get(db, "accountId");
      const isSameAccount = storedAccountId === account.id;

      let localStudents = null;
      let localSessions = null;
      let localLinks = null;

      if (isSameAccount) {
        // Same user re-logging in — read local data to merge (preserves offline edits)
        [localStudents, localSessions, localLinks] = await Promise.all([
          kv.get(db, "students"),
          kv.get(db, "sessions"),
          kv.get(db, "studentTopicLinks"),
        ]);

        // Push local data to server before fetching bootstrap (so it isn't lost)
        const uploadOps = [];
        for (const s of (localStudents ?? [])) {
          const { photo, closeAdults, ...rest } = s;
          const adultsNoPhoto = (closeAdults ?? []).map(({ photo: _p, ...a }) => a);
          uploadOps.push({ type: "student.upsert", data: { ...rest, closeAdults: adultsNoPhoto } });
        }
        for (const sess of (localSessions ?? [])) {
          uploadOps.push({ type: "session.append", data: { ...sess, mode: sess.modeId } });
        }
        const linksMap = indexStudentTopicLinks(localLinks);
        for (const link of Object.values(linksMap)) {
          if (link.studentId && link.topicId) {
            uploadOps.push({
              type: "student_topic_link.upsert",
              data: {
                id: link.id ?? `${link.studentId}_${link.topicId}`,
                studentId: link.studentId,
                topicId: link.topicId,
                selectedConceptIds: link.selectedConceptIds ?? [],
                selectionMode: link.selectionMode ?? "auto",
                repsPerConcept: link.repsPerConcept ?? 1,
                params: link.params ?? {},
                videoRewardEnabled: link.videoRewardEnabled ?? true,
                rewardThreshold: link.rewardThreshold ?? 90,
              },
            });
          }
        }
        if (uploadOps.length > 0) {
          try { await api.post("/sync", { operations: uploadOps }); } catch {}
        }
      } else {
        // Different account logging in — clear stale IDB data so nothing leaks
        await clearUserIdbData(db);
      }

      // Подгружаем все данные аккаунта с сервера
      const [bootstrap, sessionsRaw] = await Promise.all([
        api.get("/account/bootstrap"),
        api.get("/sessions?limit=200"),
      ]);

      // Merge only when the same user is re-logging in (preserves offline edits).
      // For a new/different account, use server data only.
      const students = isSameAccount
        ? mergeStudents(localStudents ?? [], bootstrap.students ?? [])
        : (bootstrap.students ?? []);

      const payload = {
        token,
        account,
        settings: bootstrap.settings,
        students,
        ownedTopics: bootstrap.ownedTopics,
        studentTopicLinks: bootstrap.studentTopicLinks,
        conceptProgress: bootstrap.conceptProgress,
        sessions: sessionsRaw,
      };

      await persistBootstrap(db, payload);
      // Tag IDB with the current account so future logins can detect account switches.
      await kv.set(db, "accountId", account.id);
      applyBootstrapToStore(payload);
      setScreen("home");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message === "email_not_verified") {
        setPendingVerificationEmail(email);
        setShowResendHint(true);
        setError("Email не подтверждён. Проверьте почту или запросите новое письмо.");
      } else {
        setError(err.message || "Ошибка входа. Проверьте email и пароль.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLocalMode() {
    const account = { email: "local", displayName: "Локальный режим" };
    const db = await getDb();
    const payload = { account, token: null };
    await persistBootstrap(db, payload);
    applyBootstrapToStore(payload);
    setScreen("home");
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">Mironium</div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          className="auth-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          autoFocus
          autoComplete="email"
        />
        <div className="auth-password-wrap">
          <input
            className="auth-input"
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPass((v) => !v)}
            tabIndex={-1}
            aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
          >
            {showPass ? "🙈" : "👁"}
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        {showResendHint && (
          <button
            type="button"
            className="auth-link"
            onClick={() => setScreen("verify_email_sent")}
          >
            Открыть страницу подтверждения
          </button>
        )}
        <Button type="submit" disabled={loading} fullWidth>
          {loading ? "Входим…" : "Войти"}
        </Button>
      </form>
      <button className="auth-link" onClick={() => setScreen("register")}>
        Нет аккаунта? Зарегистрироваться
      </button>
      <button className="auth-link auth-link--local" onClick={handleLocalMode}>
        Без аккаунта (локальный режим)
      </button>
    </div>
  );
}
