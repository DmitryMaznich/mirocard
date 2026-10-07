import { useMemo, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import { pushOp } from "@/core/syncApi";
import Button from "@/shared/components/Button";
import AuthenticatedImage from "@/shared/components/AuthenticatedImage";
import { PHOTO_ACCEPT, PhotoPrepareError, squarePhotoDataUrl } from "@/shared/utils/squarePhoto";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import {
  COUNTDOWN_OPTIONS,
  DATE_ICONS,
  DATE_TYPES,
  DEFAULT_COUNTDOWN_DAYS,
  MONTH_NAMES_GENITIVE,
  OWN_BIRTHDAY_TITLE,
  PRESET_HOLIDAYS,
  agePhrase,
  cardPhoto,
  dayPhrase,
  daysUntil,
  daysWord,
  formatDayMonth,
  isBirthdayType,
  isCompleteDraft,
  makeImportantDateId,
  normaliseImportantDates,
  ownBirthdayFromProfile,
  sortByNextOccurrence,
  suggestBirthdayTitle,
  typeInfo,
  yearsWord,
} from "./importantDates";
import "./importantDates.css";

const PHOTO_MAX_SIZE = 1024;
const PHOTO_JPEG_QUALITY = 0.85;

// Same upload-first approach as My People: only the short /api/photos
// reference travels with the sync op; offline, the data URL stays and the
// server resolves it when the op arrives.
async function storePhoto(dataUrl) {
  try {
    const { url } = await api.post("/photos", { dataUrl });
    return typeof url === "string" && url.startsWith("/api/photos/") ? url : dataUrl;
  } catch {
    return dataUrl;
  }
}

function serialiseDates(dates) {
  return dates.filter((item) => !item.isDraft).map((item) => {
    const saved = { ...item };
    delete saved.isDraft;
    return saved;
  });
}

function whenLabel(item, today) {
  const left = daysUntil(item, today);
  if (left === null) return { text: "прошло", tone: "past" };
  if (left === 0) return { text: "сегодня", tone: "today" };
  if (left === 1) return { text: "завтра", tone: "soon" };
  if (left < 60) return { text: `через ${daysWord(left)}`, tone: left <= item.countdownDays ? "soon" : "" };
  const months = Math.round(left / 30.4);
  return { text: `через ${months} мес.`, tone: "" };
}

// "исполнится 8 лет": the age at the next birthday, which may fall next year.
function ageNextTime(item, today) {
  const left = daysUntil(item, today);
  if (!item.year || left === null) return null;
  const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + left);
  const age = next.getFullYear() - item.year;
  return age > 0 ? `исполнится ${yearsWord(age)}` : null;
}

function DatePicture({ item, myPeople, className }) {
  const photo = cardPhoto(item, myPeople);
  return (
    <span className={`${className} idates-tone--${item.type}`}>
      {photo ? <AuthenticatedImage src={photo} alt="" /> : <span aria-hidden="true">{item.icon}</span>}
    </span>
  );
}

function DateCard({ item, myPeople, today, onEdit, onToggle }) {
  const when = whenLabel(item, today);
  const person = item.personId ? myPeople.find((candidate) => candidate.id === item.personId && !candidate.deletedAt) : null;
  const meta = [
    formatDayMonth(item),
    item.repeat === "once" ? "один раз" : "каждый год",
    item.type === "own_birthday" ? ageNextTime(item, today) : null,
    person ? `${person.relation || person.name} из «Моих людей»` : null,
    item.countdownDays ? `отсчёт за ${daysWord(item.countdownDays)}` : "без отсчёта",
  ].filter(Boolean).join(" · ");
  return (
    <article className={`mp-person-card idates-card${item.enabled ? "" : " mp-person-card--disabled"}`}>
      <button type="button" className="mp-person-card__main" onClick={() => onEdit(item.id)}>
        <DatePicture item={item} myPeople={myPeople} className="idates-card__picture" />
        <span className="mp-person-card__copy">
          <span className="mp-person-card__title-row">
            <strong>{item.title || "Без названия"}</strong>
            <em className={`idates-tag idates-tag--${item.type}`}>{typeInfo(item.type).label}</em>
          </span>
          <span className="mp-person-card__meta">{meta}</span>
        </span>
        <span className={`idates-card__when idates-card__when--${when.tone || "plain"}`}>{when.text}</span>
      </button>
      <label className="mp-switch" title="Показывать на экране «Сегодня»">
        <input type="checkbox" checked={item.enabled} onChange={() => onToggle(item.id)} aria-label="Показывать на экране «Сегодня»" />
        <span />
      </label>
    </article>
  );
}

function Segmented({ options, value, onChange, className = "" }) {
  return (
    <div className={`idates-seg ${className}`} role="radiogroup">
      {options.map(([optionValue, label]) => (
        <button
          key={String(optionValue)}
          type="button"
          role="radio"
          aria-checked={value === optionValue}
          className={`idates-seg__option${value === optionValue ? " idates-seg__option--active" : ""}`}
          onClick={() => onChange(optionValue)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DateEditor({ item, myPeople, onChange, onDelete, onClose }) {
  const photoRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const people = myPeople.filter((person) => !person.deletedAt && (person.name?.trim() || person.relation?.trim()));
  const linkedPerson = item.personId ? people.find((person) => person.id === item.personId) : null;
  const shownPhoto = cardPhoto(item, myPeople);
  const complete = isCompleteDraft(item);
  const isOwn = item.type === "own_birthday";
  const previewAge = isOwn && item.year ? agePhrase(item, new Date(new Date().getFullYear(), item.month - 1, item.day)) : null;

  function update(patch) { onChange({ ...item, ...patch }); }

  function changeType(type) {
    const patch = { type };
    if (isBirthdayType({ type })) patch.repeat = "yearly";
    if (type === "own_birthday") patch.title = OWN_BIRTHDAY_TITLE;
    else if (item.type === "own_birthday") patch.title = "";
    if (item.icon === typeInfo(item.type).icon) patch.icon = typeInfo(type).icon;
    update(patch);
  }

  function changePerson(personId) {
    const person = people.find((candidate) => candidate.id === personId) ?? null;
    const patch = { personId: person?.id ?? null };
    // Prefill (or keep following) the suggested title while the adult hasn't
    // written their own.
    const previousSuggestion = suggestBirthdayTitle(linkedPerson);
    if (item.type === "birthday" && person && (!item.title.trim() || item.title === previousSuggestion)) {
      patch.title = suggestBirthdayTitle(person);
    }
    update(patch);
  }

  async function addPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setUploading(true);
    setPhotoError("");
    try {
      const photo = await storePhoto(await squarePhotoDataUrl(file, { maxSize: PHOTO_MAX_SIZE, quality: PHOTO_JPEG_QUALITY }));
      update({ photo });
    } catch (error) {
      setPhotoError(error instanceof PhotoPrepareError ? error.message : "Не получилось добавить фото. Попробуйте ещё раз.");
    } finally {
      setUploading(false);
    }
  }

  const yearLabel = isBirthdayType(item)
    ? "Год рождения — необязательно"
    : item.repeat === "once" ? "Год" : null;

  return (
    <div className="mp-editor-layer" role="dialog" aria-modal="true" aria-label={item.isDraft ? "Новая важная дата" : "Важная дата"}>
      <button className="mp-editor-layer__backdrop" type="button" onClick={onClose} aria-label="Закрыть редактор" />
      <section className="mp-editor idates-editor">
        <div className="mp-editor__handle" aria-hidden="true" />
        <div className="mp-editor__head">
          <div>
            <span className="mp-editor__eyebrow">Важная дата</span>
            <h2>{item.title.trim() || (item.isDraft ? "Новая дата" : "Без названия")}</h2>
          </div>
          <button type="button" className="mp-icon-button" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>

        <div className="idates-field">
          <span className="idates-field__label">Что это за день</span>
          <Segmented
            className="idates-seg--grid"
            options={DATE_TYPES.map((type) => [type.id, `${type.icon} ${type.label}`])}
            value={item.type}
            onChange={changeType}
          />
        </div>

        {!isOwn && (
          <label className="mp-field idates-field">
            <span>Название</span>
            <input
              value={item.title}
              onChange={(event) => update({ title: event.target.value })}
              placeholder={item.type === "birthday" ? "Например, День рождения мамы" : item.type === "holiday" ? "Например, Новый год" : "Например, Идём в новую школу"}
            />
          </label>
        )}

        <div className="idates-row">
          <div className="idates-field">
            <span className="idates-field__label">Дата</span>
            <div className="idates-date">
              <select className="idates-input" value={item.day} onChange={(event) => update({ day: Number(event.target.value) })} aria-label="День">
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}</option>)}
              </select>
              <select className="idates-input" value={item.month} onChange={(event) => update({ month: Number(event.target.value) })} aria-label="Месяц">
                {MONTH_NAMES_GENITIVE.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
              </select>
            </div>
          </div>
          {!isBirthdayType(item) && (
            <div className="idates-field">
              <span className="idates-field__label">Повторять</span>
              <Segmented
                options={[["yearly", "Каждый год"], ["once", "Один раз"]]}
                value={item.repeat}
                onChange={(repeat) => update({ repeat, year: repeat === "once" ? (item.year ?? new Date().getFullYear()) : item.year })}
              />
            </div>
          )}
        </div>

        {yearLabel && (
          <label className="mp-field idates-field idates-field--year">
            <span>{yearLabel}</span>
            <input
              type="number"
              inputMode="numeric"
              min="1900"
              max="2100"
              value={item.year ?? ""}
              onChange={(event) => update({ year: event.target.value ? Number(event.target.value) : null })}
              placeholder={isBirthdayType(item) ? "Например, 2018" : String(new Date().getFullYear())}
            />
            {isOwn && <small className="mp-field__hint">С годом экран скажет «Мне 8 лет».</small>}
          </label>
        )}

        <div className="idates-field">
          <span className="idates-field__label">Картинка</span>
          <div className="idates-icons">
            {DATE_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className={`idates-icons__item${!shownPhoto && item.icon === icon ? " idates-icons__item--active" : ""}`}
                onClick={() => update({ icon, photo: null })}
                aria-label={`Значок ${icon}`}
              >
                {icon}
              </button>
            ))}
          </div>
          <div className="idates-photo-row">
            {item.photo && <AuthenticatedImage className="idates-photo-row__thumb" src={item.photo} alt="" />}
            <Button variant="secondary" onClick={() => photoRef.current?.click()} disabled={uploading}>
              {uploading ? "Готовим фото…" : item.photo ? "Другое фото" : "📷 Своё фото"}
            </Button>
            {item.photo && <button type="button" className="idates-link" onClick={() => update({ photo: null })}>Убрать фото</button>}
            {!item.photo && linkedPerson && shownPhoto && <span className="idates-photo-row__hint">Сейчас — фото из «Моих людей»</span>}
            <input ref={photoRef} type="file" accept={PHOTO_ACCEPT} onChange={addPhoto} hidden />
          </div>
          {photoError && <span className="mp-editor__photo-error" role="alert">{photoError}</span>}
        </div>

        <div className="idates-row">
          {!isOwn && (
            <label className="mp-field idates-field">
              <span>Человек из «Моих людей» — необязательно</span>
              <select value={item.personId ?? ""} onChange={(event) => changePerson(event.target.value || null)}>
                <option value="">Не выбран</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {[person.relation, person.name].filter((part) => part?.trim()).join(" — ")}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="idates-field">
            <span className="idates-field__label">Отсчёт заранее</span>
            <Segmented
              options={COUNTDOWN_OPTIONS.map((days) => [days, days ? `${days}` : "Нет"])}
              value={item.countdownDays}
              onChange={(countdownDays) => update({ countdownDays })}
            />
          </div>
        </div>

        <div className="idates-field">
          <span className="idates-field__label">Так это будет на экране «Сегодня»</span>
          <div className={`idates-preview idates-tone--${item.type}`}>
            <DatePicture item={item} myPeople={myPeople} className="idates-preview__picture" />
            <div>
              <small>{formatDayMonth({ ...item, repeat: "yearly" })}</small>
              <p>{(isOwn || item.title.trim()) ? dayPhrase(item) : "Сегодня …"}{previewAge ? ` ${previewAge}` : ""}</p>
            </div>
          </div>
        </div>

        <label className="mp-check-row">
          <input type="checkbox" checked={item.enabled} onChange={(event) => update({ enabled: event.target.checked })} />
          <span><strong>Показывать на экране «Сегодня»</strong><small>Выключенная дата остаётся в списке, но экран её не показывает.</small></span>
        </label>

        {confirmingDelete ? (
          <div className="mp-editor__actions mp-editor__actions--confirm" role="alertdialog" aria-label="Подтверждение удаления">
            <span className="mp-editor__confirm-text">Удалить «{item.title.trim() || "эту дату"}»?</span>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>Отмена</Button>
            <Button variant="danger" onClick={onDelete}>Удалить</Button>
          </div>
        ) : (
          <div className="mp-editor__actions">
            {!item.isDraft && <button type="button" className="mp-editor__delete" onClick={() => setConfirmingDelete(true)}>Удалить дату</button>}
            <Button variant="primary" onClick={onClose} disabled={!complete}>Готово</Button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function ImportantDatesScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const students = useAppStore((state) => state.students);
  const setStudents = useAppStore((state) => state.setStudents);
  const editingStudentId = useAppStore((state) => state.editingStudentId);
  const student = students.find((item) => item.id === editingStudentId) ?? null;
  const myPeople = student?.myPeople ?? [];
  const [dates, setDates] = useState(() => normaliseImportantDates(student?.importantDates));
  const [editingId, setEditingId] = useState(null);
  const datesRef = useRef(dates);
  const persistChain = useRef(Promise.resolve());
  const editorSnapshot = useRef(null);
  const today = useMemo(() => new Date(), []);

  const live = dates.filter((item) => !item.deletedAt && !item.isDraft);
  const ordinary = sortByNextOccurrence(live.filter((item) => !item.presetId), today);
  const presets = sortByNextOccurrence(live.filter((item) => item.presetId), today);
  const editing = editingId ? dates.find((item) => item.id === editingId) ?? null : null;
  const ownBirthday = ownBirthdayFromProfile(student?.myPeopleProfile?.birthDate);
  const hasOwnBirthday = live.some((item) => item.type === "own_birthday");

  // Saved as soon as a card is committed (editor closed, toggled, deleted),
  // like My People -- the back arrow never loses anything.
  function persist() {
    const run = async () => {
      const current = useAppStore.getState().students;
      const base = current.find((item) => item.id === student?.id);
      if (!base) return;
      const updatedAt = new Date().toISOString();
      const nextDates = serialiseDates(datesRef.current);
      const updated = { ...base, importantDates: nextDates, importantDatesUpdatedAt: updatedAt };
      const nextStudents = current.map((item) => item.id === base.id ? updated : item);
      setStudents(nextStudents);
      const db = await getDb();
      await kv.set(db, "students", nextStudents);
      await pushOp("student.important_dates.upsert", { studentId: base.id, dates: nextDates, updatedAt });
    };
    persistChain.current = persistChain.current.then(run, run);
    return persistChain.current;
  }

  function commit(updater) {
    datesRef.current = updater(datesRef.current);
    setDates(datesRef.current);
  }

  function stamp(item) {
    const now = new Date().toISOString();
    return { ...item, updatedAt: now, createdAt: item.createdAt ?? now };
  }

  function updateDate(next) {
    commit((current) => current.map((item) => item.id === next.id ? stamp(next) : item));
  }

  function openEditor(id) {
    editorSnapshot.current = JSON.stringify(datesRef.current.find((item) => item.id === id) ?? null);
    setEditingId(id);
  }

  function addDate(patch = {}) {
    const item = {
      id: makeImportantDateId(), type: "event", title: "", day: today.getDate(), month: today.getMonth() + 1, year: null,
      repeat: "yearly", icon: "📅", photo: null, personId: null, countdownDays: DEFAULT_COUNTDOWN_DAYS, enabled: true,
      presetId: null, createdAt: null, updatedAt: null, deletedAt: null, isDraft: true, ...patch,
    };
    commit((current) => [...current, item]);
    openEditor(item.id);
  }

  function addOwnBirthday() {
    if (!ownBirthday) return;
    const item = stamp({
      id: makeImportantDateId(), type: "own_birthday", title: OWN_BIRTHDAY_TITLE, ...ownBirthday,
      repeat: "yearly", icon: "🎂", photo: null, personId: null, countdownDays: DEFAULT_COUNTDOWN_DAYS, enabled: true,
      presetId: null, createdAt: null, updatedAt: null, deletedAt: null,
    });
    commit((current) => [...current, item]);
    persist();
  }

  function togglePreset(preset) {
    const existing = datesRef.current.find((item) => item.presetId === preset.presetId && !item.deletedAt);
    if (existing) {
      const now = new Date().toISOString();
      commit((current) => current.map((item) => item.id === existing.id ? { ...item, deletedAt: now, updatedAt: now } : item));
    } else {
      const item = stamp({
        id: makeImportantDateId(), type: "holiday", title: preset.title, day: preset.day, month: preset.month, year: null,
        repeat: "yearly", icon: preset.icon, photo: null, personId: null, countdownDays: DEFAULT_COUNTDOWN_DAYS, enabled: true,
        presetId: preset.presetId, createdAt: null, updatedAt: null, deletedAt: null,
      });
      commit((current) => [...current, item]);
    }
    persist();
  }

  function toggleDate(id) {
    const item = datesRef.current.find((candidate) => candidate.id === id);
    if (!item) return;
    updateDate({ ...item, enabled: !item.enabled });
    persist();
  }

  function deleteDate(id) {
    const now = new Date().toISOString();
    commit((current) => current.map((item) => item.id === id ? { ...item, photo: null, deletedAt: now, updatedAt: now } : item));
    setEditingId(null);
    persist();
  }

  function closeEditor() {
    const item = datesRef.current.find((candidate) => candidate.id === editingId);
    setEditingId(null);
    if (!item) return;
    if (!isCompleteDraft(item)) {
      // An unfinished new card is dropped; an existing card closed half-edited
      // (title cleared, 31 February) goes back to how it was.
      if (item.isDraft) commit((current) => current.filter((candidate) => candidate.id !== item.id));
      else commit((current) => current.map((candidate) => candidate.id === item.id ? JSON.parse(editorSnapshot.current) : candidate));
      return;
    }
    if (item.isDraft) {
      commit((current) => current.map((candidate) => {
        if (candidate.id !== item.id) return candidate;
        const saved = { ...candidate };
        delete saved.isDraft;
        return saved;
      }));
    }
    if (JSON.stringify(item) !== editorSnapshot.current) persist();
  }

  function leave() {
    const state = useAppStore.getState();
    const target = state.importantDatesReturnScreen ?? "student_edit";
    state.setImportantDatesReturnScreen(null);
    setScreen(target);
  }

  if (!student) {
    return <div className="screen-center">Сначала сохраните ученика.</div>;
  }

  return (
    <div className="screen mp-screen idates-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={leave}><BackArrowIcon /></button>
        <h1 className="screen-title">Важные даты</h1>
      </div>
      <section className="mp-intro">
        <span className="mp-intro__icon" aria-hidden="true">★</span>
        <div>
          <strong>{student.name}: важные даты</strong>
          <span>Дни рождения, праздники и события. В этот день экран «Сегодня» выглядит празднично, а заранее показывает, сколько дней осталось.</span>
        </div>
        <span className="mp-intro__sync">Изменения сохраняются сразу</span>
      </section>

      <main className="mp-body idates-body">
        {ownBirthday && !hasOwnBirthday && (
          <div className="idates-suggest">
            <span aria-hidden="true">🎂</span>
            <span>В «Моих людях» указана дата рождения ребёнка — <b>{ownBirthday.day} {MONTH_NAMES_GENITIVE[ownBirthday.month - 1]}</b>. Добавить её сюда?</span>
            <button type="button" onClick={addOwnBirthday}>Добавить «Мой день рождения»</button>
          </div>
        )}

        <div className="mp-section-head">
          <div>
            <h2>Даты</h2>
            <p>Ближайшие — сверху. Переключатель справа прячет дату с экрана, не удаляя её.</p>
          </div>
          <button type="button" className="mp-add-compact" onClick={() => addDate()}>+ Добавить дату</button>
        </div>

        <div className="mp-people-list idates-list">
          {ordinary.length
            ? ordinary.map((item) => <DateCard key={item.id} item={item} myPeople={myPeople} today={today} onEdit={openEditor} onToggle={toggleDate} />)
            : (
              <div className="mp-empty">
                <span className="mp-empty__art" aria-hidden="true">＋</span>
                <strong>Пока нет ни одной даты</strong>
                <span>Добавьте день рождения близкого человека или событие — например, «Идём в новую школу».</span>
                <button type="button" onClick={() => addDate()}>Добавить дату</button>
              </div>
            )}
        </div>

        <div className="mp-section-head idates-presets-head">
          <div>
            <h2>Готовые праздники</h2>
            <p>Включите те, что важны для вашей семьи.</p>
          </div>
        </div>
        <div className="idates-chips">
          {PRESET_HOLIDAYS.map((preset) => {
            const active = live.some((item) => item.presetId === preset.presetId);
            return (
              <button
                key={preset.presetId}
                type="button"
                className={`idates-chip${active ? " idates-chip--active" : ""}`}
                aria-pressed={active}
                onClick={() => togglePreset(preset)}
              >
                <span aria-hidden="true">{preset.icon}</span> {preset.title}{active ? " ✓" : ""}
              </button>
            );
          })}
        </div>
        {presets.length > 0 && (
          <div className="mp-people-list idates-list idates-list--presets">
            {presets.map((item) => <DateCard key={item.id} item={item} myPeople={myPeople} today={today} onEdit={openEditor} onToggle={toggleDate} />)}
          </div>
        )}
      </main>

      {editing && (
        <DateEditor
          item={editing}
          myPeople={myPeople}
          onChange={updateDate}
          onDelete={() => deleteDate(editing.id)}
          onClose={closeEditor}
        />
      )}
    </div>
  );
}
