import { useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { api } from "@/core/api";
import { clearUserIdbData } from "@/core/bootstrap";
import AccountCard from "./AccountCard";
import ChangePasswordModal from "./ChangePasswordModal";
import DangerZone from "./DangerZone";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";

export default function AccountScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const logout    = useAppStore((s) => s.logout);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  async function handleLogout() {
    try { await api.post("/auth/logout"); } catch {
      // Local logout should still proceed when the network request fails.
    }
    const db = await getDb();
    await clearUserIdbData(db);
    logout();
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">Аккаунт</h1>
      </div>

      <div className="settings-body">
        <AccountCard onLogout={handleLogout} />

        <div className="settings-section">
          <div className="settings-section-title">Безопасность</div>
          <div className="settings-row">
            <span className="settings-row__label">Пароль</span>
            <button className="link-btn" onClick={() => setChangePasswordOpen(true)}>
              Сменить пароль
            </button>
          </div>
        </div>
      </div>

      <DangerZone />

      {changePasswordOpen && (
        <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />
      )}
    </div>
  );
}
