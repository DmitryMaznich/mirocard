import { useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { api } from "@/core/api";
import { clearUserIdbData } from "@/core/bootstrap";
import Button from "@/shared/components/Button";

export default function DangerZone() {
  const account = useAppStore((s) => s.account);
  const logout = useAppStore((s) => s.logout);

  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const canDelete = confirmEmail.trim().toLowerCase() === (account?.email ?? "").toLowerCase();

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    setError("");
    try {
      await api.delete("/account");
      const db = await getDb();
      await clearUserIdbData(db);
      logout();
    } catch (err) {
      setError(err.message || "Не удалось удалить аккаунт. Попробуйте ещё раз.");
      setDeleting(false);
    }
  }

  return (
    <div className="danger-zone">
      <div className="danger-zone__title">Удаление аккаунта</div>
      <p className="danger-zone__text">
        Это действие необратимо. Все ученики, занятия и история прогресса будут удалены безвозвратно.
      </p>

      {!open ? (
        <button className="danger-zone__trigger" onClick={() => setOpen(true)}>
          Удалить аккаунт
        </button>
      ) : (
        <div className="danger-zone__confirm">
          <label className="danger-zone__label">
            Чтобы подтвердить, введите ваш email: <strong>{account?.email}</strong>
          </label>
          <input
            className="account-card__input"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="Email для подтверждения"
            autoFocus
          />
          {error && <div className="form-error">{error}</div>}
          <div className="danger-zone__actions">
            <Button variant="secondary" onClick={() => { setOpen(false); setConfirmEmail(""); setError(""); }} disabled={deleting}>
              Отмена
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={!canDelete || deleting}>
              {deleting ? "Удаляем…" : "Удалить навсегда"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
