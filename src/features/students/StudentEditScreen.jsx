import { useState, useRef } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";
import { isValidYoutubeUrl, fetchYoutubeTitle, getVideoUrl, getInitials } from "@/shared/utils/format";

function generateStudentId() {
  return "student_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function normaliseVideos(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) =>
    typeof v === "string" ? { url: v, title: null } : { url: v.url ?? "", title: v.title ?? null }
  );
}
function normaliseAdults(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => ({ id: a.id, name: a.name ?? "", photo: a.photo ?? null }));
}
async function resizeToDataUrl(file, maxSize = 400) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const size = Math.min(s, maxSize);
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = url;
  });
}

const LANGS = [
  { value: "",   label: "Не задан" },
  { value: "ru", label: "Русский"  },
  { value: "en", label: "English"  },
];

const SEXES = [
  { value: "",  label: "Не указан" },
  { value: "m", label: "Мальчик"   },
  { value: "f", label: "Девочка"   },
];

function AdultAddForm({ onConfirm, onCancel }) {
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const photoRef  = useRef(null);
  const cameraRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setPhoto(await resizeToDataUrl(file, 200));
    setLoading(false);
  }

  function confirm() {
    if (name.trim()) onConfirm({ id: generateId(), name: name.trim(), photo });
  }

  return (
    <div className="se-adult-add-form">
      <div className="se-adult-add-form__row">
        {photo ? (
          <img src={photo} className="se-adult-add-form__preview" onClick={() => cameraRef.current?.click()} alt="" />
        ) : (
          <div className="se-adult-add-form__photo-btns">
            <button type="button" className="se-adult-add-form__photo-btn" onClick={() => cameraRef.current?.click()} disabled={loading}>
              {loading ? "…" : "📷"}
            </button>
            <button type="button" className="se-adult-add-form__photo-btn" onClick={() => photoRef.current?.click()} disabled={loading}>
              🖼
            </button>
          </div>
        )}
        <input
          className="se-adult-add-form__input"
          type="text"
          placeholder="Имя (Мама, Папа, …)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirm()}
          autoFocus
        />
        <input ref={cameraRef} type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={handleFile} />
        <input ref={photoRef}  type="file" accept="image/*"               style={{ display: "none" }} onChange={handleFile} />
      </div>
      <div className="se-adult-add-form__actions">
        <Button variant="secondary" onClick={onCancel}>Отмена</Button>
        <Button variant="primary" onClick={confirm} disabled={!name.trim()}>Добавить</Button>
      </div>
    </div>
  );
}

export default function StudentEditScreen() {
  const setScreen           = useAppStore((s) => s.setScreen);
  const students            = useAppStore((s) => s.students);
  const setStudents         = useAppStore((s) => s.setStudents);
  const editingStudentId    = useAppStore((s) => s.editingStudentId);
  const studentTopicLinks   = useAppStore((s) => s.studentTopicLinks);
  const topicRecords        = useAppStore((s) => s.topicRecords);

  const initial = editingStudentId ? (students.find((s) => s.id === editingStudentId) ?? null) : null;
  const isEdit  = !!initial;

  const [name,         setName]         = useState(initial?.name ?? "");
  const [comment,      setComment]      = useState(initial?.comment ?? "");
  const [lang,         setLang]         = useState(initial?.primaryLanguage ?? "");
  const [sex,          setSex]          = useState(initial?.sex ?? "");
  const [photo,        setPhoto]        = useState(initial?.photo ?? null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [videos,       setVideos]       = useState(() => normaliseVideos(initial?.rewardVideos));
  const [videoInput,   setVideoInput]   = useState("");
  const [videoError,   setVideoError]   = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [adults,       setAdults]       = useState(() => normaliseAdults(initial?.closeAdults));
  const [addingAdult,  setAddingAdult]  = useState(false);
  const [nameError,    setNameError]    = useState("");
  const [confirmDel,   setConfirmDel]   = useState(false);
  const [saving,       setSaving]       = useState(false);

  // Portal management
  const [portals,         setPortals]         = useState(null);
  const [portalsLoading,  setPortalsLoading]  = useState(false);
  const [newPortalLabel,  setNewPortalLabel]  = useState("");
  const [newPortalTopic,  setNewPortalTopic]  = useState("");
  const [newPortalMode,   setNewPortalMode]   = useState("");
  const [portalUrlMap,    setPortalUrlMap]    = useState({});   // { [portalId]: url }
  const [confirmRevokeId, setConfirmRevokeId] = useState(null);
  const [activeTaskLocal, setActiveTaskLocal] = useState(null);

  const studentPhotoRef = useRef(null);

  function goBack() { setScreen("students"); }

  async function loadPortals() {
    if (!isEdit || portalsLoading) return;
    setPortalsLoading(true);
    try {
      const data = await api.get(`/students/${initial.id}/portals`);
      setPortals(data.portals);
    } catch {
      setPortals([]);
    } finally {
      setPortalsLoading(false);
    }
  }

  async function handleCreatePortal() {
    if (!newPortalTopic || !newPortalMode) return;
    try {
      const data = await api.post(`/students/${initial.id}/portal`, {
        label:   newPortalLabel || null,
        topicId: newPortalTopic,
        modeId:  newPortalMode,
      });
      setPortalUrlMap((prev) => ({ ...prev, [data.portalId]: data.url }));
      setNewPortalLabel("");
      setNewPortalTopic("");
      setNewPortalMode("");
      loadPortals();
    } catch { /* show nothing — portal section stays visible */ }
  }

  function shareOrCopy(url) {
    if (navigator.share) {
      navigator.share({ title: "Ссылка для ученика", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  async function handleRevokePortal(portalId) {
    try {
      await api.delete(`/students/${initial.id}/portal/${portalId}`);
    } catch { /* best effort */ }
    setConfirmRevokeId(null);
    loadPortals();
  }

  async function handleSetActiveTask(topicId) {
    const isSame = activeTaskLocal?.topicId === topicId;
    const next = isSame ? null : { topicId, modeId: null };
    try {
      await api.patch(`/students/${initial.id}/active-task`, next ?? { topicId: null, modeId: null });
      setActiveTaskLocal(next);
    } catch { /* ignore */ }
  }

  async function handleStudentPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    setPhoto(await resizeToDataUrl(file, 400));
    setPhotoLoading(false);
  }

  async function handleSave() {
    if (!name.trim()) { setNameError("Введите имя ученика"); return; }
    setSaving(true);
    const data = {
      name: name.trim(), comment: comment.trim(),
      primaryLanguage: lang || null,
      sex: sex || null,
      photo: photo ?? null,
      rewardVideos: videos, closeAdults: adults,
    };
    const db = await getDb();
    if (isEdit) {
      const updated = { ...initial, ...data, updatedAt: new Date().toISOString() };
      const next = students.map((s) => (s.id === initial.id ? updated : s));
      await kv.set(db, "students", next);
      setStudents(next);
      pushOp("student.upsert", updated);
    } else {
      const student = { id: generateStudentId(), ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const next = [...students, student];
      await kv.set(db, "students", next);
      setStudents(next);
      pushOp("student.upsert", student);
    }
    goBack();
  }

  async function handleDelete() {
    const db = await getDb();
    const next = students.filter((s) => s.id !== initial.id);
    await kv.set(db, "students", next);
    setStudents(next);
    pushOp("student.delete", { id: initial.id });
    goBack();
  }

  async function addVideo() {
    const url = videoInput.trim();
    if (!isValidYoutubeUrl(url)) { setVideoError("Неверная ссылка YouTube"); return; }
    setVideoLoading(true); setVideoError("");
    const title = await fetchYoutubeTitle(url);
    setVideos((prev) => [...prev, { url, title }]);
    setVideoInput("");
    setVideoLoading(false);
  }

  const initials = name.trim() ? getInitials(name) : "?";

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={goBack}>←</button>
        <h1 className="screen-title">{isEdit ? initial.name : "Новый ученик"}</h1>
        <button className="se-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? "…" : "Сохранить"}
        </button>
      </div>

      <div className="se-body">
       <div className="se-col">

        {/* ── Профиль ── */}
        <div className="settings-section">
          <div className="se-profile-row">
            <button
              type="button"
              className="se-photo-btn"
              onClick={() => studentPhotoRef.current?.click()}
              title="Изменить фото"
            >
              {photo
                ? <img src={photo} className="se-photo-btn__img" alt="" />
                : <div className="se-photo-btn__initials">{photoLoading ? "…" : initials}</div>
              }
              <div className="se-photo-btn__cam">📷</div>
            </button>
            <input
              className="se-name-input"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(""); }}
              placeholder="Имя ученика"
              autoFocus={!isEdit}
            />
            <input
              ref={studentPhotoRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleStudentPhoto}
            />
          </div>
          {nameError && <div className="se-name-error">{nameError}</div>}
          <textarea
            className="se-comment-input"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Заметки, особенности, цели…"
            rows={3}
          />
        </div>

        {/* ── Пол ── */}
        <div className="settings-section">
          <div className="settings-section-title">Пол</div>
          {SEXES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`se-lang-row${sex === value ? " se-lang-row--active" : ""}`}
              onClick={() => setSex(value)}
            >
              {label}
              {sex === value && <span className="se-lang-check">✓</span>}
            </button>
          ))}
        </div>

        {/* ── Язык ── */}
        <div className="settings-section">
          <div className="settings-section-title">Язык</div>
          {LANGS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`se-lang-row${lang === value ? " se-lang-row--active" : ""}`}
              onClick={() => setLang(value)}
            >
              {label}
              {lang === value && <span className="se-lang-check">✓</span>}
            </button>
          ))}
        </div>

       </div>{/* /se-col left */}
       <div className="se-col">

        {/* ── Близкие взрослые ── */}
        <div className="settings-section">
          <div className="settings-section-title">Близкие взрослые</div>
          {adults.map((adult) => (
            <div key={adult.id} className="se-list-row">
              {adult.photo
                ? <img src={adult.photo} className="se-list-avatar" alt={adult.name} />
                : <div className="se-list-avatar se-list-avatar--initials">{getInitials(adult.name)}</div>
              }
              <span className="se-list-name">{adult.name}</span>
              <button className="se-list-remove" onClick={() => setAdults((p) => p.filter((a) => a.id !== adult.id))}>✕</button>
            </div>
          ))}
          {addingAdult
            ? <AdultAddForm
                onConfirm={(a) => { setAdults((p) => [...p, a]); setAddingAdult(false); }}
                onCancel={() => setAddingAdult(false)}
              />
            : <button type="button" className="se-add-row" onClick={() => setAddingAdult(true)}>
                + Добавить взрослого
              </button>
          }
        </div>

        {/* ── Видео-награды ── */}
        <div className="settings-section">
          <div className="settings-section-title">Видео-награды</div>
          {videos.map((v, idx) => (
            <div key={idx} className="se-list-row">
              <span className="se-video-icon">▶</span>
              <span className="se-list-name">{v.title || getVideoUrl(v)}</span>
              <button className="se-list-remove" onClick={() => setVideos((p) => p.filter((_, i) => i !== idx))}>✕</button>
            </div>
          ))}
          <div className="se-video-add-row">
            <input
              className="se-video-input"
              type="url"
              placeholder="https://youtu.be/…"
              value={videoInput}
              disabled={videoLoading}
              onChange={(e) => { setVideoInput(e.target.value); setVideoError(""); }}
              onKeyDown={(e) => e.key === "Enter" && addVideo()}
            />
            <button className="se-video-add-btn" onClick={addVideo} disabled={videoLoading}>
              {videoLoading ? "…" : "Добавить"}
            </button>
          </div>
          {videoError && <div className="form-error se-video-error">{videoError}</div>}
        </div>

       </div>{/* /se-col right */}
      </div>{/* /se-body */}

      {/* ── Активные ссылки ученика ── */}
      {isEdit && (
        <div className="settings-section" style={{ margin: "0 16px 8px" }}>
          <div className="settings-section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Активные ссылки
            {portals === null && (
              <button type="button" className="se-add-row" style={{ fontSize: 12 }} onClick={loadPortals}>
                Показать
              </button>
            )}
          </div>

          {portals !== null && (
            <>
              {portalsLoading && (
                <div style={{ color: "#9ca3af", fontSize: 13, padding: "6px 0" }}>Загрузка…</div>
              )}

              {portals.map((portal) => {
                const topicRec = portal.active_topic_id
                  ? topicRecords.find((r) => r.meta?.id === portal.active_topic_id)
                  : null;
                const topicTitle = topicRec
                  ? (topicRec.meta?.title?.ru ?? topicRec.meta?.title ?? portal.active_topic_id)
                  : portal.active_topic_id ?? "—";
                const modeRec = topicRec && portal.active_mode_id
                  ? topicRec.modes?.find((m) => m.id === portal.active_mode_id)
                  : null;
                const modeTitle = modeRec
                  ? (modeRec.ui?.title?.ru ?? modeRec.ui?.title ?? portal.active_mode_id)
                  : portal.active_mode_id ?? "—";
                return (
                  <div key={portal.id} className="se-list-row" style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: 6 }}>
                    <span className="se-list-name">
                      <span style={{ fontWeight: 600 }}>{topicTitle}</span>
                      {portal.active_mode_id && (
                        <span style={{ color: "#6b7280" }}> · {modeTitle}</span>
                      )}
                      {portal.last_used_at && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: "#9ca3af" }}>
                          · {new Date(portal.last_used_at).toLocaleDateString("ru")}
                        </span>
                      )}
                    </span>
                    {confirmRevokeId === portal.id ? (
                      <>
                        <button className="se-list-remove" style={{ color: "#dc2626" }} onClick={() => handleRevokePortal(portal.id)}>✓</button>
                        <button className="se-list-remove" onClick={() => setConfirmRevokeId(null)}>✕</button>
                      </>
                    ) : (
                      <button className="se-list-remove" onClick={() => setConfirmRevokeId(portal.id)}>Отозвать</button>
                    )}
                  </div>
                );
              })}

              {portals.length === 0 && !portalsLoading && (
                <div style={{ color: "#9ca3af", fontSize: 13, padding: "4px 0" }}>
                  Нет активных ссылок. Создайте ссылку из режима темы (↗ Отправить ученику).
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Удаление — мелко, внизу ── */}
      {isEdit && (
        <div className="se-delete-footer">
          {confirmDel ? (
            <div className="se-delete-confirm se-delete-confirm--footer">
              <div className="se-delete-confirm__text">
                Удалить <strong>{initial.name}</strong>? История сессий будет утеряна.
              </div>
              <div className="se-delete-confirm__actions">
                <Button variant="secondary" onClick={() => setConfirmDel(false)}>Отмена</Button>
                <Button variant="danger" onClick={handleDelete}>Удалить</Button>
              </div>
            </div>
          ) : (
            <button className="se-delete-link" onClick={() => setConfirmDel(true)}>
              Удалить ученика
            </button>
          )}
        </div>
      )}
    </div>
  );
}
