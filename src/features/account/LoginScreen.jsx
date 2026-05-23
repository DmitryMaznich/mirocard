import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api, setApiToken } from "@/core/api";
import { getDb, kv } from "@/core/db";
import { persistBootstrap, applyBootstrapToStore, indexStudentTopicLinks, mergeStudents } from "@/core/bootstrap";
import Button from "@/shared/components/Button";

export default function LoginScreen() {
  const setScreen = useAppStore((s) => s.setScreen);

  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { account, token } = await api.post("/auth/login", { email, password });
      setApiToken(token);

      // Push local data to server before fetching bootstrap (so it isn't lost)
      const db = await getDb();
      const [localStudents, localSessions, localLinks] = await Promise.all([
        kv.get(db, "students"),
        kv.get(db, "sessions"),
        kv.get(db, "studentTopicLinks"),
      ]);
      const uploadOps = [];
      for (const s of (localStudents ?? [])) {
        // Photos are synced separately via the push-op queue — strip them from the bulk upload
        // so login doesn't send hundreds of KB of base64 per student.
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

      // Подгружаем все данные аккаунта с сервера
      const [bootstrap, sessionsRaw] = await Promise.all([
        api.get("/account/bootstrap"),
        api.get("/sessions?limit=200"),
      ]);

      // Merge: local wins if updatedAt >= server's (preserves edits made before login)
      const mergedStudents = mergeStudents(localStudents ?? [], bootstrap.students ?? []);
      const payload = {
        token,
        account,
        settings: bootstrap.settings,
        students: mergedStudents,
        ownedTopics: bootstrap.ownedTopics,
        studentTopicLinks: bootstrap.studentTopicLinks,
        conceptProgress: bootstrap.conceptProgress,
        sessions: sessionsRaw,
      };

      await persistBootstrap(db, payload);
      applyBootstrapToStore(payload);
      setScreen("home");
    } catch (err) {
      setError(err.message || "Ошибка входа. Проверьте email и пароль.");
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
      <div className="auth-logo">Mirocard</div>
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
