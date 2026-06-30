import { useState } from "react";
import { api } from "@/core/api";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";

export default function ChangePasswordModal({ onClose }) {
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
      setError("Новый пароль должен содержать минимум 8 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
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
          ? "Текущий пароль неверен"
          : (err.message || "Не удалось сменить пароль")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Смена пароля" onClose={onClose}>
      {success ? (
        <div className="change-password__success">
          <div className="change-password__success-icon">✓</div>
          <p>Пароль успешно изменён</p>
          <Button onClick={onClose} fullWidth>Готово</Button>
        </div>
      ) : (
        <form className="auth-form" style={{ maxWidth: "none" }} onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type={showPass ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Текущий пароль"
            required
            autoFocus
            autoComplete="current-password"
          />
          <input
            className="auth-input"
            type={showPass ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Новый пароль (минимум 8 символов)"
            required
            autoComplete="new-password"
          />
          <input
            className="auth-input"
            type={showPass ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Повторите новый пароль"
            required
            autoComplete="new-password"
          />
          <label className="change-password__show-toggle">
            <input type="checkbox" checked={showPass} onChange={(e) => setShowPass(e.target.checked)} />
            <span>Показать пароли</span>
          </label>
          {error && <div className="form-error">{error}</div>}
          <Button type="submit" disabled={loading} fullWidth>
            {loading ? "Сохраняем…" : "Сменить пароль"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
