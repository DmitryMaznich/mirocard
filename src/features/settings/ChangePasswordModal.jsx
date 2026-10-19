import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useState } from "react";
import { api } from "@/core/api";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";

export default function ChangePasswordModal({ onClose }) {
  const { t: tr } = useUiTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("password.tooShort");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("password.mismatch");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post("/account/change-password", { currentPassword, newPassword });
      setSuccess(true);
    } catch (err) {
      setError(
        err.message === "Current password is incorrect"
          ? "password.incorrect"
          : "password.failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={tr("password.title")} onClose={onClose}>
      {success ? (
        <div className="change-password__success">
          <div className="change-password__success-icon">✓</div>
          <p>{tr("password.success")}</p>
          <Button onClick={onClose} fullWidth>{tr("common.done")}</Button>
        </div>
      ) : (
        <form className="auth-form" style={{ maxWidth: "none" }} onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type={showPass ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={tr("password.current")}
            required
            autoFocus
            autoComplete="current-password"
          />
          <input
            className="auth-input"
            type={showPass ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={tr("password.new")}
            required
            autoComplete="new-password"
          />
          <input
            className="auth-input"
            type={showPass ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={tr("password.confirm")}
            required
            autoComplete="new-password"
          />
          <label className="change-password__show-toggle">
            <input type="checkbox" checked={showPass} onChange={(e) => setShowPass(e.target.checked)} />
            <span>{tr("password.show")}</span>
          </label>
          {error && <div className="form-error">{tr(error)}</div>}
          <Button type="submit" disabled={loading} fullWidth>
            {loading ? tr("account.saving") : tr("account.changePassword")}
          </Button>
        </form>
      )}
    </Modal>
  );
}
