import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { api } from "@/core/api";
import { clearUserIdbData } from "@/core/bootstrap";
import Button from "@/shared/components/Button";

export default function DangerZone() {
  const { t: tr } = useUiTranslation();
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
    } catch {
      setError("account.deleteError");
      setDeleting(false);
    }
  }

  return (
    <div className="danger-zone">
      <div className="danger-zone__title">{tr("account.deleteTitle")}</div>
      <p className="danger-zone__text">{tr("account.deleteExplanation")}</p>

      {!open ? (
        <button className="danger-zone__trigger" onClick={() => setOpen(true)}>{tr("account.delete")}</button>
      ) : (
        <div className="danger-zone__confirm">
          <label className="danger-zone__label">
            {tr("account.confirmDelete", { email: account?.email })}
          </label>
          <input
            className="account-card__input"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={tr("account.confirmEmail")}
            autoFocus
          />
          {error && <div className="form-error">{tr(error)}</div>}
          <div className="danger-zone__actions">
            <Button variant="secondary" onClick={() => { setOpen(false); setConfirmEmail(""); setError(""); }} disabled={deleting}>{tr("common.cancel")}</Button>
            <Button variant="danger" onClick={handleDelete} disabled={!canDelete || deleting}>
              {deleting ? tr("account.deleting") : tr("account.delete")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
