import { useState, useRef } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import Button from "@/shared/components/Button";
import AuthenticatedImage from "@/shared/components/AuthenticatedImage";
import { isValidYoutubeUrl, fetchYoutubeTitle, getVideoUrl, getInitials } from "@/shared/utils/format";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { resizeStudentPhotoToDataUrl } from "./studentPhoto";

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
    setPhoto(await resizeStudentPhotoToDataUrl(file));
    setLoading(false);
  }

  function confirm() {
    if (name.trim()) onConfirm({ id: generateId(), name: name.trim(), photo });
  }

  return (
    <div className="se-adult-add-form">
      <div className="se-adult-add-form__row">
        {photo ? (
          <AuthenticatedImage src={photo} className="se-adult-add-form__preview" onClick={() => cameraRef.current?.click()} alt="" />
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
  const studentEditReturnScreen    = useAppStore((s) => s.studentEditReturnScreen);
  const setStudentEditReturnScreen = useAppStore((s) => s.setStudentEditReturnScreen);

  const initial = editingStudentId ? (students.find((s) => s.id === editingStudentId) ?? null) : null;
  const isEdit  = !!initial;
  const isFirstEver = !isEdit && students.length === 0;

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
  // GDPR Art. 9: "Заметки" is free text and routinely ends up holding
  // health/development notes (speech-therapy diagnoses, delays) — that's a
  // special data category needing its own explicit consent, separate from
  // the generic account-level checkbox at registration.
  const [healthDataConsent, setHealthDataConsent] = useState(initial?.healthDataConsent ?? false);
  const [healthConsentError, setHealthConsentError] = useState("");

  const studentPhotoRef = useRef(null);

  function goBack() {
    setScreen(studentEditReturnScreen ?? "students");
    setStudentEditReturnScreen(null);
  }

  async function handleStudentPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    setPhoto(await resizeStudentPhotoToDataUrl(file));
    setPhotoLoading(false);
  }

  async function handleSave() {
    if (!name.trim()) { setNameError("Введите имя ученика"); return; }
    if (comment.trim() && !healthDataConsent) {
      setHealthConsentError("Отметьте согласие ниже, если в заметках есть сведения о здоровье или особенностях развития");
      return;
    }
    setHealthConsentError("");
    setSaving(true);
    const ts = new Date().toISOString();
    const photoChanged = photo !== (initial?.photo ?? null);
    const healthConsentChanged = healthDataConsent !== (initial?.healthDataConsent ?? false);
    const healthDataConsentAt = healthDataConsent
      ? (healthConsentChanged ? ts : (initial?.healthDataConsentAt ?? ts))
      : null;
    const data = {
      name: name.trim(), comment: comment.trim(),
      primaryLanguage: lang || null,
      sex: sex || null,
      rewardVideos: videos, closeAdults: adults,
      healthDataConsent, healthDataConsentAt,
    };
    const db = await getDb();
    if (isEdit) {
      const photoUpdatedAt = photoChanged ? ts : (initial.photoUpdatedAt ?? null);
      // Compare against the snapshot the form was opened with — if this device's copy
      // of the student was stale (another device added videos/adults meanwhile), an
      // untouched list here must NOT be pushed as if it were a deliberate change.
      const videosChanged = JSON.stringify(videos) !== JSON.stringify(normaliseVideos(initial.rewardVideos));
      const adultsChanged = JSON.stringify(adults) !== JSON.stringify(normaliseAdults(initial.closeAdults));
      const rewardVideosUpdatedAt = videosChanged ? ts : (initial.rewardVideosUpdatedAt ?? null);
      const closeAdultsUpdatedAt  = adultsChanged ? ts : (initial.closeAdultsUpdatedAt ?? null);
      const updated = {
        ...initial, ...data,
        photo: photo ?? null, photoUpdatedAt,
        rewardVideosUpdatedAt, closeAdultsUpdatedAt,
        updatedAt: ts,
      };
      const next = students.map((s) => (s.id === initial.id ? updated : s));
      await kv.set(db, "students", next);
      setStudents(next);
      // student.upsert covers only name/comment/language/sex — photo, video rewards and
      // close adults are each synced independently (their own op + timestamp), so a
      // stale device that hasn't seen another device's additions can't erase them.
      pushOp("student.upsert", { ...updated, photo: undefined, rewardVideos: undefined, closeAdults: undefined });
      if (photoChanged) {
        pushOp("student.photo.upsert", { studentId: initial.id, photo: photo ?? null, photoUpdatedAt: ts });
      }
      if (videosChanged) {
        pushOp("student.videos.upsert", { studentId: initial.id, rewardVideos: videos, updatedAt: ts });
      }
      if (adultsChanged) {
        pushOp("student.adults.upsert", { studentId: initial.id, closeAdults: adults, updatedAt: ts });
      }
    } else {
      const photoUpdatedAt = photo ? ts : null;
      const student = {
        id: generateStudentId(), ...data,
        photo: photo ?? null, photoUpdatedAt,
        createdAt: ts, updatedAt: ts,
      };
      const next = [...students, student];
      await kv.set(db, "students", next);
      setStudents(next);
      // For new students, upsert includes photo (server INSERT uses it)
      pushOp("student.upsert", student);
      // Also push photo op to ensure photo_updated_at is set correctly on the server
      if (photo) {
        pushOp("student.photo.upsert", { studentId: student.id, photo, photoUpdatedAt: ts });
      }
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
        <button className="back-btn" onClick={goBack}><BackArrowIcon /></button>
        <h1 className="screen-title">{isEdit ? initial.name : isFirstEver ? "Первый ученик" : "Новый ученик"}</h1>
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
                ? <AuthenticatedImage src={photo} className="se-photo-btn__img" alt="" />
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
            onChange={(e) => { setComment(e.target.value); setHealthConsentError(""); }}
            placeholder="Заметки, особенности, цели…"
            rows={3}
          />
          <label className="se-health-consent">
            <input
              type="checkbox"
              checked={healthDataConsent}
              onChange={(e) => { setHealthDataConsent(e.target.checked); setHealthConsentError(""); }}
            />
            <span>
              В заметках есть сведения о здоровье или особенностях развития ребёнка — даю согласие
              на их обработку
            </span>
          </label>
          {healthConsentError && <div className="se-name-error">{healthConsentError}</div>}
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

        {/* ── Мои люди ── */}
        {isEdit && (
          <div className="settings-section se-my-people-card">
            <div className="settings-section-title">Мои люди</div>
            <p>Семья, люди дома, школа и личные ответы для индивидуальной темы.</p>
            <button type="button" className="se-add-row" onClick={() => setScreen("my_people_settings")}>
              {initial.myPeople?.some((person) => !person.deletedAt) ? "Настроить тему" : "Заполнить тему"}
            </button>
          </div>
        )}

        {/* ── Близкие взрослые ── */}
        <div className="settings-section">
          <div className="settings-section-title">Близкие взрослые</div>
          {adults.map((adult) => (
            <div key={adult.id} className="se-list-row">
              {adult.photo
                ? <AuthenticatedImage src={adult.photo} className="se-list-avatar" alt={adult.name} />
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
