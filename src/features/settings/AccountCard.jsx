import { getUiLanguage } from "@/shared/i18n/uiLanguage.js";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";



function initialsOf(account) {
  const a = (account?.firstName || "").trim();
  const b = (account?.lastName || "").trim();
  if (a || b) return ((a[0] ?? "") + (b[0] ?? "")).toUpperCase() || "?";
  const email = account?.email || "";
  return email[0]?.toUpperCase() || "?";
}

function memberSince(account) {
  if (!account?.createdAt) return null;
  try {
    return new Intl.DateTimeFormat(getUiLanguage() === "sl" ? "sl-SI" : "ru-RU", { month: "long", year: "numeric" }).format(new Date(account.createdAt));
  } catch {
    return null;
  }
}

export default function AccountCard({ onLogout }) {
  const { t: tr } = useUiTranslation();
const ROLE_LABELS = { parent: tr("account.parent"), specialist: tr("account.specialist") };

  const account = useAppStore((s) => s.account);
  const setAccount = useAppStore((s) => s.setAccount);

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(account?.firstName ?? "");
  const [lastName, setLastName] = useState(account?.lastName ?? "");
  const [role, setRole] = useState(account?.role ?? "parent");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setFirstName(account?.firstName ?? "");
    setLastName(account?.lastName ?? "");
    setRole(account?.role ?? "parent");
    setError("");
    setEditing(true);
  }

  async function handleSave() {
    if (!firstName.trim()) {
      setError("account.nameRequired");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch("/account", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
      });
      const merged = { ...account, ...updated };
      setAccount(merged);
      const db = await getDb();
      await kv.set(db, "account", merged);
      setEditing(false);
    } catch {
      setError("account.saveError");
    } finally {
      setSaving(false);
    }
  }

  const sinceLabel = memberSince(account);

  return (
    <div className="account-card">
      <div className="account-card__glow" aria-hidden="true" />

      {!confirmLogout ? (
        <button className="account-card__logout-btn" onClick={() => setConfirmLogout(true)}>{tr("account.logout")}</button>
      ) : (
        <div className="account-card__logout-confirm">
          <button className="account-card__logout-no" onClick={() => setConfirmLogout(false)}>{tr("common.no")}</button>
          <button className="account-card__logout-yes" onClick={onLogout}>{tr("account.logout")}</button>
        </div>
      )}

      <div className="account-card__avatar">{initialsOf(account)}</div>

      {!editing ? (
        <div className="account-card__body">
          <div className="account-card__name">
            {account?.firstName || account?.lastName
              ? `${account.firstName ?? ""} ${account.lastName ?? ""}`.trim()
              : (account?.displayName || tr("account.unnamed"))}
          </div>
          {ROLE_LABELS[account?.role] && (
            <span className="account-card__role-pill">{ROLE_LABELS[account.role]}</span>
          )}
          <div className="account-card__email">{account?.email ?? "—"}</div>
          {sinceLabel && <div className="account-card__since">{tr("account.since", { date: sinceLabel })}</div>}

          <div className="account-card__actions">
            <button className="account-card__edit-btn" onClick={startEdit} aria-label={tr("account.editProfile")}>{tr("account.edit")}</button>
          </div>
        </div>
      ) : (
        <div className="account-card__body account-card__body--edit">
          <div className="account-card__email account-card__email--static">{account?.email ?? "—"}</div>
          <input
            className="account-card__input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder={tr("account.firstName")}
            autoFocus
          />
          <input
            className="account-card__input"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={tr("account.lastName")}
          />
          <select
            className="account-card__input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="parent">{tr("account.parent")}</option>
            <option value="specialist">{tr("account.specialist")}</option>
          </select>

          {error && <div className="form-error">{tr(error)}</div>}

          <div className="account-card__edit-actions">
            <button className="account-card__cancel-btn" onClick={() => setEditing(false)} disabled={saving}>{tr("common.cancel")}</button>
            <button className="account-card__save-btn" onClick={handleSave} disabled={saving}>
              {saving ? tr("account.saving") : tr("common.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
