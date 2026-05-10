import { useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";

function fakeSession(pct, studentId, topicId) {
  const total = 10;
  const correct = Math.round(total * pct / 100);
  return {
    id: "dev_" + Date.now(),
    studentId: studentId ?? "dev",
    topicId:   topicId   ?? "dev",
    topicVersion: "1.0.0",
    modeId:    "yes_no",
    conceptIds: [],
    startedAt:   new Date().toISOString(),
    completedAt: new Date().toISOString(),
    correctCount:   correct,
    incorrectCount: total - correct,
    percentCorrect: pct,
    mistakes: [],
  };
}

export default function SettingsScreen() {
  const setScreen        = useAppStore((s) => s.setScreen);
  const account          = useAppStore((s) => s.account);
  const buildInfo        = useAppStore((s) => s.buildInfo);
  const logout           = useAppStore((s) => s.logout);
  const appendSession    = useAppStore((s) => s.appendSession);
  const activeStudentId  = useAppStore((s) => s.activeStudentId);
  const activeTopicId    = useAppStore((s) => s.activeTopicId);

  function testSummary(pct) {
    appendSession(fakeSession(pct, activeStudentId, activeTopicId));
    setScreen("summary");
  }

  const [confirmLogout, setConfirmLogout] = useState(false);

  async function handleLogout() {
    try { await api.post("/auth/logout"); } catch {}
    const db = await getDb();
    await kv.del(db, "token");
    await kv.del(db, "account");
    logout();
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}>←</button>
        <h1 className="screen-title">Настройки</h1>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-section-title">Аккаунт</div>
          <div className="settings-row">
            <div className="settings-row__label">Email</div>
            <div className="settings-row__value">{account?.email ?? "—"}</div>
          </div>
          <div className="settings-row">
            <div className="settings-row__label">Имя</div>
            <div className="settings-row__value">{account?.displayName ?? "—"}</div>
          </div>
        </div>

        <div className="settings-section">
          {!confirmLogout ? (
            <button className="settings-danger-btn" onClick={() => setConfirmLogout(true)}>
              Выйти из аккаунта
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, padding: 12 }}>
              <Button variant="secondary" onClick={() => setConfirmLogout(false)}>Отмена</Button>
              <Button variant="danger" onClick={handleLogout}>Выйти</Button>
            </div>
          )}
        </div>
      </div>

      <div className="settings-section" style={{ borderTop: "1px dashed #ddd", marginTop: 8 }}>
        <div className="settings-section-title" style={{ color: "#bbb" }}>Dev · тест экрана завершения</div>
        <div style={{ display: "flex", gap: 8, padding: "8px 12px", flexWrap: "wrap" }}>
          {[100, 90, 75, 50, 30].map((pct) => (
            <button
              key={pct}
              onClick={() => testSummary(pct)}
              style={{
                padding: "6px 14px", borderRadius: 10, border: "1px solid #ddd",
                background: "#f5f5f5", fontSize: 14, cursor: "pointer",
              }}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      <div className="settings-build-info">
        v{buildInfo.version} · {buildInfo.gitSha}
      </div>
    </div>
  );
}
