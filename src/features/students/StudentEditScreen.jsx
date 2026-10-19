import { useState, useRef, useCallback, useMemo } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import { PHOTO_ACCEPT, PhotoPrepareError, squarePhotoDataUrl } from "@/shared/utils/squarePhoto";
import Button from "@/shared/components/Button";
import AuthenticatedImage from "@/shared/components/AuthenticatedImage";
import { isValidYoutubeUrl, fetchYoutubeTitle, getVideoUrl, getInitials, extractYoutubeId } from "@/shared/utils/format";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { rewardVideoViewCount } from "@/shared/utils/rewardVideoViews";
import StudentDataInfo from "./StudentDataInfo";
import ScreenHints, { HintButton } from "@/shared/components/ScreenHints";
import "./StudentEditHints.css";

function generateStudentId() {
  return "student_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}
function normaliseVideos(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) =>
    typeof v === "string" ? { url: v, title: null } : { url: v.url ?? "", title: v.title ?? null }
  );
}
function photoErrorMessage(error) {
  return error instanceof PhotoPrepareError ? error.message : "Не получилось добавить фото. Попробуйте ещё раз.";
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

export default function StudentEditScreen() {
  const setScreen           = useAppStore((s) => s.setScreen);
  const students            = useAppStore((s) => s.students);
  const setStudents         = useAppStore((s) => s.setStudents);
  const editingStudentId    = useAppStore((s) => s.editingStudentId);
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
  const [photoError, setPhotoError] = useState("");
  const [videos,       setVideos]       = useState(() => normaliseVideos(initial?.rewardVideos));
  const [videoInput,   setVideoInput]   = useState("");
  const [videoError,   setVideoError]   = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
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
  const [hintsOpen, setHintsOpen] = useState(false);
  const closeHints = useCallback(() => setHintsOpen(false), []);
  const nameHintRef = useRef(null);
  const photoHintRef = useRef(null);
  const notesHintRef = useRef(null);
  const sexHintRef = useRef(null);
  const languageHintRef = useRef(null);
  const peopleHintRef = useRef(null);
  const datesHintRef = useRef(null);
  const videosHintRef = useRef(null);
  const saveHintRef = useRef(null);
  const hintSteps = useMemo(() => [
    { targetRef: nameHintRef, title: "Введите имя ученика", text: "Имя нужно, чтобы сохранить профиль и узнавать ученика в списке. Остальные поля можно заполнить позже." },
    { targetRef: photoHintRef, title: "Добавьте фото", text: "Нажмите на аватар, чтобы выбрать фотографию ученика. Фото добавлять необязательно." },
    { targetRef: notesHintRef, title: "Запишите важное", text: "Здесь можно указать цели занятий и особенности ученика. Если заполняете заметки, отметьте согласие ниже." },
    { targetRef: sexHintRef, title: "Укажите пол", text: "Эта настройка используется в теме «Мои люди» для вопроса «Ты мальчик или девочка?». Можно оставить «Не указан»." },
    { targetRef: languageHintRef, title: "Выберите основной язык", text: "Укажите язык, на котором общается ученик. Эта информация будет отображаться в профиле; можно оставить «Не задан»." },
    { targetRef: peopleHintRef, title: "Добавьте окружение", text: "Здесь можно добавить знакомых людей и питомцев для занятий. При переходе приложение сначала сохранит профиль." },
    ...(isEdit ? [{ targetRef: datesHintRef, title: "Добавьте важные даты", text: "Дни рождения, праздники и события появятся на экране «Сегодня». Добавлять даты необязательно." }] : []),
    { targetRef: videosHintRef, title: "Подберите видео-награды", text: "Вставьте ссылку на любимое видео YouTube и нажмите «Добавить». Эти ролики используются для поощрения во время занятий." },
    { targetRef: saveHintRef, title: "Сохраните настройки", text: "Когда закончите, нажмите «Сохранить». Подсказки сами ничего не меняют и не сохраняют." },
  ], [isEdit]);

  function goBack() {
    closeHints();
    setScreen(studentEditReturnScreen ?? "students");
    setStudentEditReturnScreen(null);
  }

  async function handleStudentPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPhotoLoading(true);
    setPhotoError("");
    try {
      setPhoto(await squarePhotoDataUrl(file, { maxSize: 400, quality: 0.85 }));
    } catch (error) {
      setPhotoError(photoErrorMessage(error));
    } finally {
      setPhotoLoading(false);
    }
  }

  async function handleSave(destination = null) {
    closeHints();
    let savedId = initial?.id;
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
      rewardVideos: videos,
      healthDataConsent, healthDataConsentAt,
    };
    const db = await getDb();
    if (isEdit) {
      const photoUpdatedAt = photoChanged ? ts : (initial.photoUpdatedAt ?? null);
      // Compare against the snapshot the form was opened with — if this device's copy
      // of the student was stale (another device added videos/adults meanwhile), an
      // untouched list here must NOT be pushed as if it were a deliberate change.
      const videosChanged = JSON.stringify(videos) !== JSON.stringify(normaliseVideos(initial.rewardVideos));
      const rewardVideosUpdatedAt = videosChanged ? ts : (initial.rewardVideosUpdatedAt ?? null);
      const updated = {
        ...useAppStore.getState().students.find((item) => item.id === initial.id), ...data,
        photo: photo ?? null, photoUpdatedAt,
        rewardVideosUpdatedAt,
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

    } else {
      const photoUpdatedAt = photo ? ts : null;
      const student = {
        id: generateStudentId(), ...data,
        photo: photo ?? null, photoUpdatedAt,
        createdAt: ts, updatedAt: ts,
      };
      savedId = student.id;
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
    if (destination === 'my_people_settings') {
      useAppStore.getState().setEditingStudentId(savedId);
      useAppStore.getState().setMyPeopleReturnScreen('student_edit');
      setScreen('my_people_settings');
    } else goBack();
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
    <div className="screen student-edit-screen">
      <div className="screen-header" onClickCapture={(event) => {
        if (!event.target.closest('.screen-hint-button')) closeHints();
      }}>
        <button className="back-btn" onClick={goBack}><BackArrowIcon /></button>
        <h1 className="screen-title">{isEdit ? initial.name : isFirstEver ? "Первый ученик" : "Новый ученик"}</h1>
        <HintButton onClick={() => setHintsOpen(true)} hidden={hintsOpen} />
        <button ref={saveHintRef} className="se-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? "…" : "Сохранить"}
        </button>
      </div>

      <div className="se-body" onClickCapture={(event) => {
        // Close the tour before opening a photo picker, explanation or sub-screen.
        if (event.target.closest('button')) closeHints();
      }}>
       <div className="se-col">

        {/* ── Профиль ── */}
        <div className="settings-section">
          <div className="settings-section-title student-data-heading">Имя и фото <StudentDataInfo kind="profile" /></div>
          <div className="se-profile-row">
            <button
              type="button"
              ref={photoHintRef}
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
              ref={nameHintRef}
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
              accept={PHOTO_ACCEPT}
              style={{ display: "none" }}
              onChange={handleStudentPhoto}
            />
          </div>
          {nameError && <div className="se-name-error">{nameError}</div>}
          {photoError && <div className="se-name-error" role="alert">{photoError}</div>}
          <div className="settings-section-title student-data-heading">Заметки <StudentDataInfo kind="notes" /></div>
          <textarea
            ref={notesHintRef}
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
        <div ref={sexHintRef} className="settings-section">
          <div className="settings-section-title student-data-heading">Пол <StudentDataInfo kind="sex" /></div>
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
        <div ref={languageHintRef} className="settings-section">
          <div className="settings-section-title student-data-heading">Язык <StudentDataInfo kind="language" /></div>
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

        <div className="settings-section se-my-people-card">
          <div className="settings-section-title">Окружение ребёнка</div>
          <p>Добавьте знакомых людей и питомцев — их фотографии будут использоваться в занятиях.</p>
          <button ref={peopleHintRef} type="button" className="se-add-row" disabled={saving} onClick={() => handleSave('my_people_settings')}>
            {isEdit ? 'Настроить окружение' : 'Сохранить и добавить окружение'}
          </button>
        </div>

        {/* ── Важные даты ── */}
        {isEdit && (
          <div className="settings-section se-my-people-card">
            <div className="settings-section-title student-data-heading">Важные даты <StudentDataInfo kind="dates" /></div>
            <p>Дни рождения, праздники и события — для экрана «Сегодня».</p>
            <button ref={datesHintRef} type="button" className="se-add-row" onClick={() => { useAppStore.getState().setImportantDatesReturnScreen("student_edit"); setScreen("important_dates_settings"); }}>
              {initial.importantDates?.some((item) => !item.deletedAt) ? "Настроить даты" : "Добавить даты"}
            </button>
          </div>
        )}

        {/* ── Видео-награды ── */}
        <div className="settings-section">
          <div className="settings-section-title student-data-heading">Видео-награды <StudentDataInfo kind="videos" /></div>
          {videos.map((v, idx) => (
            <div key={idx} className="se-list-row">
              <span className="se-video-icon">▶</span>
              <span className="se-list-name">
                {v.title || getVideoUrl(v)}
                <span className="reward-video-view-count">Показано: {rewardVideoViewCount(initial?.rewardVideoViews, extractYoutubeId(getVideoUrl(v)))} раз</span>
              </span>
              <button className="se-list-remove" onClick={() => setVideos((p) => p.filter((_, i) => i !== idx))}>✕</button>
            </div>
          ))}
          <div ref={videosHintRef} className="se-video-add-row">
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
            <button className="se-delete-link" onClick={() => { closeHints(); setConfirmDel(true); }}>
              Удалить ученика
            </button>
          )}
        </div>
      )}
      {hintsOpen && <ScreenHints steps={hintSteps} onClose={closeHints} />}
    </div>
  );
}
