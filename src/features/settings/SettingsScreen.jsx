import { useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";

export default function SettingsScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const account   = useAppStore((s) => s.account);
  const buildInfo = useAppStore((s) => s.buildInfo);
  const logout    = useAppStore((s) => s.logout);

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

      <div className="settings-build-info">
        v{buildInfo.version} · {buildInfo.gitSha}
      </div>
    </div>
  );
}
