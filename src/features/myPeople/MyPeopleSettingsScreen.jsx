import { useMemo, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import { pushOp } from "@/core/syncApi";
import Button from "@/shared/components/Button";
import AuthenticatedImage from "@/shared/components/AuthenticatedImage";
import { PHOTO_ACCEPT, PhotoPrepareError, squarePhotoDataUrl } from "@/shared/utils/squarePhoto";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { getInitials, pluralRu } from "@/shared/utils/format";

const TABS = [
  ["family", "Семья и питомцы"],
  ["home", "Люди дома"],
  ["school", "Школа"],
  ["personal", "Личные данные"],
  ["order", "Порядок"],
];

const CONTEXT_LABELS = {
  family: "Семья",
  home: "Дома",
  school: "Школа",
};

const BLOCKS = [
  ["family", "Семья и питомцы"],
  ["home", "Люди дома"],
  ["school", "Школа"],
  ["mix", "Микс"],
];

function makeId() {
  return `person_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function normaliseProfile(profile) {
  return {
    familyName: "",
    familyLabel: "",
    birthDate: "",
    city: "",
    address: "",
    includeSelfName: true,
    includeFamilyName: false,
    includeFamilyLabel: false,
    includeCity: false,
    includeAddress: false,
    enabledBlocks: { family: true, home: true, school: true, mix: true },
    blockOrder: ["family", "home", "school", "mix"],
    ...(profile ?? {}),
  };
}

function normalisePeople(people) {
  return Array.isArray(people) ? people.map((person) => ({
    id: person.id ?? makeId(),
    type: person.type === "pet" ? "pet" : "person",
    name: person.name ?? "",
    relation: person.relation ?? "",
    contexts: Array.isArray(person.contexts) ? person.contexts : [],
    photos: Array.isArray(person.photos) ? person.photos.filter(Boolean) : [],
    introducedAxes: Array.isArray(person.introducedAxes) ? [...new Set(person.introducedAxes.filter(Boolean))] : [],
    enabled: person.enabled !== false,
    createdAt: person.createdAt ?? null,
    updatedAt: person.updatedAt ?? null,
    deletedAt: person.deletedAt ?? null,
  })) : [];
}

// Drafts that never got a name or a photo are not worth keeping; the
// isDraft marker is editor-only state.
function serialisePeople(people, updatedAt) {
  return people
    .filter((person) => !person.isDraft || person.name.trim() || person.photos.length)
    .map((person) => {
      const savedPerson = { ...person };
      delete savedPerson.isDraft;
      return { ...savedPerson, updatedAt: savedPerson.updatedAt ?? updatedAt };
    });
}

// The largest place a person's photo is shown is ~520 CSS px wide (the naming
// card in my_people.css), so 1024 px covers it on a 2x screen. Going higher
// only made every upload, sync and cold load slower for no visible gain.
// Product limits (2026-09-30): past ~20 people the topic stops being "the
// child's own circle" and the lessons get long; more than 5 photos of one
// person adds upload weight without helping recognition.
const MAX_ACTIVE_PEOPLE = 20;
const MAX_PHOTOS_PER_PERSON = 5;
const ACTIVE_LIMIT_HINT = `Не больше ${MAX_ACTIVE_PEOPLE} человек в теме. Выключите кого-то, чтобы добавить нового.`;

const PERSON_PHOTO_MAX_SIZE = 1024;
const PERSON_PHOTO_JPEG_QUALITY = 0.85;

// Upload each photo on its own as soon as it's ready and keep only the short
// /api/photos reference on the card. Otherwise every save of the list would
// carry all photos as base64 in one sync op -- megabytes that on a slow
// mobile uplink can outlast the 30 s request timeout on every retry and hold
// up everything queued behind it. Offline, the data URL stays and travels
// with the regular sync op as before; the server resolves it then.
async function storePhoto(dataUrl) {
  try {
    const { url } = await api.post("/photos", { dataUrl });
    return typeof url === "string" && url.startsWith("/api/photos/") ? url : dataUrl;
  } catch {
    return dataUrl;
  }
}


function PersonCard({ person, canEnable, onEdit, onToggle }) {
  const photo = person.photos[0] ?? null;
  const places = person.contexts.map((context) => CONTEXT_LABELS[context]).filter(Boolean).join(" · ");
  return (
    <article className={`mp-person-card${person.enabled ? "" : " mp-person-card--disabled"}`}>
      <button type="button" className="mp-person-card__main" onClick={() => onEdit(person.id)}>
        {photo
          ? <AuthenticatedImage className="mp-person-card__photo" src={photo} alt="" />
          : <div className="mp-person-card__photo mp-person-card__photo--fallback">{person.type === "pet" ? "🐾" : getInitials(person.name || "?")}</div>
        }
        <span className="mp-person-card__copy">
          <span className="mp-person-card__title-row">
            <strong>{person.name || "Без имени"}</strong>
            {person.relation && <em>{person.relation}</em>}
          </span>
          <span className="mp-person-card__meta">
            {person.photos.length ? `${person.photos.length} ${person.photos.length === 1 ? "фото" : "фото"}` : "Нет фото"}
            {places && ` · ${places}`}
          </span>
        </span>
        <span className="mp-person-card__arrow" aria-hidden="true">›</span>
      </button>
      <label className="mp-switch" title={person.enabled || canEnable ? "Включать в тему" : ACTIVE_LIMIT_HINT}>
        <input type="checkbox" checked={person.enabled} disabled={!person.enabled && !canEnable} onChange={() => onToggle(person.id)} />
        <span />
      </label>
    </article>
  );
}

function PersonEditor({ person, activeContext, canEnable, onChange, onPhotoAdded, onPhotoRemoved, onDelete, onClose }) {
  const photoRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  // Both removals are two-step: the first tap only arms them. A single stray
  // tap must not throw away a photo or a whole card (with all its photos).
  const [armedPhoto, setArmedPhoto] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function tapRemovePhoto(photo) {
    if (armedPhoto !== photo) { setArmedPhoto(photo); return; }
    setArmedPhoto(null);
    onPhotoRemoved(person.id, photo);
  }

  async function addPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setUploading(true);
    setPhotoError("");
    try {
      const photo = await storePhoto(await squarePhotoDataUrl(file, { maxSize: PERSON_PHOTO_MAX_SIZE, quality: PERSON_PHOTO_JPEG_QUALITY }));
      // The photo is the expensive part to redo -- save it right away rather
      // than waiting for "Готово", so a killed PWA or a backgrounded tab can't
      // take it with it. Only the id goes up: a HEIC conversion takes a few
      // seconds, and this render's `person` may be stale by then.
      onPhotoAdded(person.id, photo);
    } catch (error) {
      setPhotoError(error instanceof PhotoPrepareError ? error.message : "Не получилось добавить фото. Попробуйте ещё раз.");
    } finally {
      setUploading(false);
    }
  }

  function update(patch) { onChange({ ...person, ...patch }); }
  function toggleContext(context) {
    const contexts = person.contexts.includes(context)
      ? person.contexts.filter((item) => item !== context)
      : [...person.contexts, context];
    update({ contexts });
  }

  return (
    <div className="mp-editor-layer" role="dialog" aria-modal="true" aria-label={person.isDraft ? "Добавить человека" : "Настройки человека"}>
      <button className="mp-editor-layer__backdrop" type="button" onClick={onClose} aria-label="Закрыть редактор" />
      <section className="mp-editor">
        <div className="mp-editor__handle" aria-hidden="true" />
        <div className="mp-editor__head">
          <div>
            <span className="mp-editor__eyebrow">Мои люди</span>
            <h2>{person.isDraft ? "Добавить человека" : "Карточка человека"}</h2>
            <p>Имя и связь с ребёнком учатся как разные понятия.</p>
          </div>
          <button type="button" className="mp-icon-button" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>

        <div className="mp-editor__photo-row">
          {/* With photos, the strip below shows them all; the placeholder only
              stands in while there are none yet. */}
          {!person.photos.length && <div className="mp-editor__photo mp-editor__photo--empty">{person.type === "pet" ? "🐾" : "📷"}</div>}
          <div className="mp-editor__photo-copy">
            <strong>{person.photos.length ? "Фотографии добавлены" : "Добавьте фотографию"}</strong>
            <span>{!person.photos.length
              ? "На фото человек должен быть хорошо виден."
              : person.photos.length >= MAX_PHOTOS_PER_PERSON
                ? `${person.photos.length} фото · это максимум`
                : `${person.photos.length} фото · можно добавить ещё`}</span>
            {person.photos.length < MAX_PHOTOS_PER_PERSON && (
              <Button variant="secondary" onClick={() => photoRef.current?.click()} disabled={uploading}>
                {uploading ? "Готовим фото…" : person.photos.length ? "+ Ещё фото" : "Выбрать фото"}
              </Button>
            )}
            {photoError && <span className="mp-editor__photo-error" role="alert">{photoError}</span>}
          </div>
          <input ref={photoRef} type="file" accept={PHOTO_ACCEPT} onChange={addPhoto} hidden />
        </div>
        {person.photos.length > 0 && (
          <ul className="mp-editor__photos" aria-label="Фотографии">
            {person.photos.map((photo, index) => (
              <li key={photo} className={`mp-editor__thumb${armedPhoto === photo ? " mp-editor__thumb--armed" : ""}`}>
                <AuthenticatedImage src={photo} alt="" />
                <button
                  type="button"
                  className="mp-editor__thumb-remove"
                  onClick={() => tapRemovePhoto(photo)}
                  aria-label={armedPhoto === photo ? `Точно удалить фото ${index + 1}` : `Удалить фото ${index + 1}`}
                >
                  {armedPhoto === photo ? "Удалить?" : "✕"}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mp-editor__fields">
          <label className="mp-field mp-field--type">
            <span>Это</span>
            <select value={person.type} onChange={(event) => update({ type: event.target.value })}>
              <option value="person">Человек</option>
              <option value="pet">Питомец</option>
            </select>
          </label>
          <label className="mp-field">
            <span>Имя</span>
            <input value={person.name} onChange={(event) => update({ name: event.target.value })} placeholder="Например, Анна" autoFocus />
          </label>
          <label className="mp-field mp-field--wide">
            <span>Кто это для ребёнка?</span>
            <input value={person.relation} onChange={(event) => update({ relation: event.target.value })} placeholder={person.type === "pet" ? "Например, наша кошка" : "Например, мама"} />
          </label>
        </div>

        <fieldset className="mp-contexts">
          <legend>Где ребёнок встречает этого человека?</legend>
          <p>Можно отметить несколько мест — это определит, в каких режимах появится карточка.</p>
          <div className="mp-contexts__row">
            {Object.entries(CONTEXT_LABELS).map(([context, label]) => (
              <label key={context} className={`mp-context-chip${person.contexts.includes(context) ? " mp-context-chip--active" : ""}`}>
                <input type="checkbox" checked={person.contexts.includes(context)} onChange={() => toggleContext(context)} />
                {label}
              </label>
            ))}
          </div>
          {activeContext && !person.contexts.includes(activeContext) && (
            <button type="button" className="mp-context-hint" onClick={() => toggleContext(activeContext)}>
              + Добавить в «{CONTEXT_LABELS[activeContext]}»
            </button>
          )}
        </fieldset>

        <label className="mp-check-row">
          <input type="checkbox" checked={person.enabled} disabled={!person.enabled && !canEnable} onChange={(event) => update({ enabled: event.target.checked })} />
          <span><strong>Включать в тему</strong><small>{person.enabled || canEnable ? "Человек будет появляться в заданиях и в миксе." : ACTIVE_LIMIT_HINT}</small></span>
        </label>

        {confirmingDelete ? (
          <div className="mp-editor__actions mp-editor__actions--confirm" role="alertdialog" aria-label="Подтверждение удаления">
            <span className="mp-editor__confirm-text">
              {/* Quoted, not declined: "Удалить Анна" reads wrong, and names can't be declined reliably. */}
              Удалить {person.name.trim() ? `карточку «${person.name.trim()}»` : "эту карточку"}{person.photos.length ? " вместе с фото" : ""}?
            </span>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>Отмена</Button>
            <Button variant="danger" onClick={onDelete}>Удалить</Button>
          </div>
        ) : (
          <div className="mp-editor__actions">
            {person.createdAt && <button type="button" className="mp-editor__delete" onClick={() => setConfirmingDelete(true)}>Удалить карточку</button>}
            <Button variant="primary" onClick={onClose} disabled={!person.name.trim() || !person.relation.trim() || person.contexts.length === 0}>Готово</Button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function MyPeopleSettingsScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const students = useAppStore((state) => state.students);
  const setStudents = useAppStore((state) => state.setStudents);
  const editingStudentId = useAppStore((state) => state.editingStudentId);
  const student = students.find((item) => item.id === editingStudentId) ?? null;
  const [tab, setTab] = useState("family");
  const [profile, setProfile] = useState(() => normaliseProfile(student?.myPeopleProfile));
  const [people, setPeople] = useState(() => normalisePeople(student?.myPeople));
  const [editingId, setEditingId] = useState(null);
  const peopleRef = useRef(people);
  const profileRef = useRef(profile);
  const persistChain = useRef(Promise.resolve());
  const editorSnapshot = useRef(null);

  const editing = editingId ? people.find((person) => person.id === editingId) ?? null : null;
  const activeCount = people.filter((person) => !person.deletedAt && person.enabled).length;
  const canEnableMore = activeCount < MAX_ACTIVE_PEOPLE;
  const visiblePeople = useMemo(() => people.filter((person) => !person.deletedAt && person.contexts.includes(tab)), [people, tab]);
  const peopleByContext = useMemo(() => Object.fromEntries(
    Object.keys(CONTEXT_LABELS).map((context) => [context, people.filter((person) => !person.deletedAt && person.contexts.includes(context)).length]),
  ), [people]);
  const introductionsByContext = useMemo(() => Object.fromEntries(
    Object.keys(CONTEXT_LABELS).map((context) => {
      const activePeople = people.filter((person) => (
        !person.deletedAt && person.enabled !== false && person.contexts.includes(context)
      ));
      return [context, {
        introduced: activePeople.filter((person) => person.introducedAxes.includes("name")).length,
        total: activePeople.length,
      }];
    }),
  ), [people]);

  // Every change to a card is written to IndexedDB and queued for sync as
  // soon as it's committed (photo added, editor closed, card toggled or
  // deleted). Before this, nothing left the screen's React state until the
  // header "Сохранить" -- the back arrow, an iOS PWA eviction or a reload
  // silently threw away every photo and caption entered so far.
  function persist({ withProfile = false } = {}) {
    const run = async () => {
      const current = useAppStore.getState().students;
      const base = current.find((item) => item.id === student?.id);
      if (!base) return;
      const updatedAt = new Date().toISOString();
      const nextPeople = serialisePeople(peopleRef.current, updatedAt);
      const updated = { ...base, myPeople: nextPeople, myPeopleUpdatedAt: updatedAt };
      let nextProfile = null;
      if (withProfile) {
        nextProfile = { ...profileRef.current, updatedAt };
        updated.myPeopleProfile = nextProfile;
        updated.myPeopleProfileUpdatedAt = updatedAt;
      }
      const nextStudents = current.map((item) => item.id === base.id ? updated : item);
      setStudents(nextStudents);
      const db = await getDb();
      await kv.set(db, "students", nextStudents);
      await Promise.all([
        nextProfile && pushOp("student.my_people_profile.upsert", { studentId: base.id, profile: nextProfile, updatedAt }),
        pushOp("student.my_people.upsert", { studentId: base.id, people: nextPeople, updatedAt }),
      ]);
    };
    persistChain.current = persistChain.current.then(run, run);
    return persistChain.current;
  }

  function openEditor(id) {
    editorSnapshot.current = JSON.stringify(peopleRef.current.find((person) => person.id === id) ?? null);
    setEditingId(id);
  }

  function commitPeople(updater) {
    peopleRef.current = updater(peopleRef.current);
    setPeople(peopleRef.current);
  }

  async function goBack() {
    // The profile tabs have no per-field commit point; keep their edits too.
    const profileDirty = JSON.stringify(profile) !== JSON.stringify(normaliseProfile(student?.myPeopleProfile));
    if (profileDirty) await persist({ withProfile: true });
    leave();
  }
  function leave() {
    const state = useAppStore.getState();
    const target = state.myPeopleReturnScreen ?? "student_edit";
    state.setMyPeopleReturnScreen(null);
    setScreen(target);
  }
  function updateProfile(patch) {
    profileRef.current = { ...profileRef.current, ...patch };
    setProfile(profileRef.current);
  }
  function updatePerson(nextPerson) {
    const now = new Date().toISOString();
    const stamped = { ...nextPerson, updatedAt: now, createdAt: nextPerson.createdAt ?? now };
    commitPeople((current) => current.map((person) => person.id === stamped.id ? stamped : person));
  }
  function removePhotoAndPersist(personId, photo) {
    const person = peopleRef.current.find((item) => item.id === personId);
    if (!person) return;
    updatePerson({ ...person, photos: person.photos.filter((item) => item !== photo) });
    persist();
  }
  function addPhotoAndPersist(personId, photo) {
    const person = peopleRef.current.find((item) => item.id === personId);
    if (!person || person.photos.length >= MAX_PHOTOS_PER_PERSON) return;
    updatePerson({ ...person, photos: [...person.photos, photo] });
    persist();
  }
  function addPerson() {
    if (!canEnableMore) return;
    const person = {
      id: makeId(), type: "person", name: "", relation: "", contexts: tab in CONTEXT_LABELS ? [tab] : ["family"],
      photos: [], introducedAxes: [], enabled: true, createdAt: null, updatedAt: null, deletedAt: null, isDraft: true,
    };
    commitPeople((current) => [...current, person]);
    openEditor(person.id);
  }
  function deletePerson(id) {
    const now = new Date().toISOString();
    // Drop the photos with the card so the server can prune them (photo-gc).
    commitPeople((current) => current.map((person) => person.id === id ? { ...person, photos: [], deletedAt: now, updatedAt: now } : person));
    setEditingId(null);
    persist();
  }
  function togglePerson(id) {
    const person = peopleRef.current.find((item) => item.id === id);
    if (!person) return;
    if (!person.enabled && !canEnableMore) return;
    updatePerson({ ...person, enabled: !person.enabled });
    persist();
  }
  function closeEditor() {
    const person = peopleRef.current.find((item) => item.id === editingId);
    setEditingId(null);
    if (!person) return;
    if (person.isDraft && !person.name.trim() && !person.photos.length) {
      commitPeople((current) => current.filter((item) => item.id !== person.id));
      return;
    }
    // Once closed with content, the card is saved -- no longer a draft.
    if (person.isDraft) {
      commitPeople((current) => current.map((item) => {
        if (item.id !== person.id) return item;
        const saved = { ...item };
        delete saved.isDraft;
        return saved;
      }));
    }
    // An untouched card has nothing new to send.
    if (JSON.stringify(person) !== editorSnapshot.current) persist();
  }
  function moveBlock(id, delta) {
    const current = profile.blockOrder.filter((item) => item !== id);
    const index = Math.max(0, Math.min(current.length, profile.blockOrder.indexOf(id) + delta));
    current.splice(index, 0, id);
    // Mix always closes the sequence; otherwise it would defeat staged learning.
    const mixIndex = current.indexOf("mix");
    if (mixIndex >= 0) current.push(...current.splice(mixIndex, 1));
    updateProfile({ blockOrder: current });
  }



  if (!student) {
    return <div className="screen-center">Сначала сохраните ученика.</div>;
  }

  return (
    <div className="screen mp-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={goBack}><BackArrowIcon /></button>
        <h1 className="screen-title">Мои люди</h1>
      </div>
      <section className="mp-intro">
        <span className="mp-intro__icon" aria-hidden="true">◎</span>
        <div>
          <strong>Индивидуальная тема {student.name}</strong>
          <span>Семья, дом, школа — с фотографиями, именами и связями.</span>
        </div>
        {/* Cards save as they're edited and the back arrow keeps the profile tabs,
            so there is no separate save button (a "Сохранить" in the header
            implied nothing was saved until it was pressed). */}
        <span className="mp-intro__sync">Изменения сохраняются сразу</span>
      </section>
      <nav className="mp-tabs" aria-label="Разделы темы">
        {TABS.map(([id, label], index) => {
          const cardCount = peopleByContext[id] || 0;
          const introduction = introductionsByContext[id];
          const hint = id in CONTEXT_LABELS
            ? `${cardCount} ${pluralRu(cardCount, "карточка", "карточки", "карточек")}${cardCount && introduction.total ? ` · Знакомство: ${introduction.introduced} из ${introduction.total}` : ""}`
            : id === "personal" ? "Фамилия и адрес" : "Режимы занятия";
          return (
            <button key={id} type="button" className={tab === id ? "mp-tab mp-tab--active" : "mp-tab"} onClick={() => { setTab(id); closeEditor(); }}>
              <span className="mp-tab__number">{String(index + 1).padStart(2, "0")}</span>
              <span><strong>{label}</strong><small>{hint}</small></span>
            </button>
          );
        })}
      </nav>

      <main className="mp-body">
        {tab in CONTEXT_LABELS && (
          <>
            <div className="mp-section-head">
              <div>
                <span className="mp-section-head__eyebrow">Шаг {TABS.findIndex(([id]) => id === tab) + 1} из 5</span>
                <h2>{TABS.find(([id]) => id === tab)?.[1]}</h2>
                <p>{tab === "family" ? "Начните с 2–4 самых близких людей или питомцев." : "Добавьте тех, с кем ребёнок регулярно встречается."}</p>
              </div>
              <button type="button" className="mp-add-compact" onClick={addPerson} disabled={!canEnableMore}>+ Добавить</button>
            </div>
            {!canEnableMore && <p className="mp-limit-hint" role="status">{ACTIVE_LIMIT_HINT}</p>}
            <div className="mp-people-layout">
              <div className="mp-people-list">
                {visiblePeople.length
                  ? visiblePeople.map((person) => <PersonCard key={person.id} person={person} canEnable={canEnableMore} onEdit={openEditor} onToggle={togglePerson} />)
                  : <div className="mp-empty"><span className="mp-empty__art" aria-hidden="true">＋</span><strong>Здесь пока никого нет</strong><span>{tab === "family" ? "Добавьте первого близкого человека или питомца." : "Добавьте человека, который встречается с ребёнком в этом окружении."}</span><button type="button" onClick={addPerson} disabled={!canEnableMore}>Добавить карточку</button></div>
                }
              </div>
              {editing && <PersonEditor person={editing} activeContext={tab} canEnable={canEnableMore} onChange={updatePerson} onPhotoAdded={addPhotoAndPersist} onPhotoRemoved={removePhotoAndPersist} onDelete={() => deletePerson(editing.id)} onClose={closeEditor} />}
            </div>
          </>
        )}

        {tab === "personal" && (
          <section className="mp-personal">
            <div className="mp-section-head mp-section-head--stacked"><div><span className="mp-section-head__eyebrow">Шаг 4 из 5</span><h2>Личные данные</h2><p>Добавьте только те ответы, которые хотите отрабатывать с {student.name}.</p></div></div>
            <div className="mp-personal__grid">
            <div className="mp-form-card mp-form-card--identity">
              <h3>Имя и фамилия</h3>
              <p className="mp-form-card__lead">Фамилия ребёнка и название семьи — разные ответы в задании.</p>
              <label className="mp-field"><span>Фамилия ребёнка</span><input value={profile.familyName} onChange={(event) => updateProfile({ familyName: event.target.value })} /></label>
              <label className="mp-field"><span>Как называть семью</span><input value={profile.familyLabel} onChange={(event) => updateProfile({ familyLabel: event.target.value })} placeholder="Например, семья Петровых" /></label>
              <label className="mp-field">
                <span>Дата рождения</span>
                <input type="date" value={profile.birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => updateProfile({ birthDate: event.target.value })} />
                <small className="mp-field__hint">Для вопроса «Сколько тебе лет?» — возраст считается сам.</small>
              </label>
            </div>
            <div className="mp-form-card">
              <h3>Где я живу</h3>
              <p className="mp-form-card__lead">Адрес можно оставить выключенным и использовать только со взрослым.</p>
              <label className="mp-field"><span>Город</span><input value={profile.city} onChange={(event) => updateProfile({ city: event.target.value })} /></label>
              <label className="mp-field"><span>Адрес — необязательно</span><input value={profile.address} onChange={(event) => updateProfile({ address: event.target.value })} /></label>
            </div>
            </div>
            <div className="mp-form-card mp-form-card--toggles">
              <h3>Что включать в тему</h3>
              {[
                ["includeSelfName", "Моё имя"], ["includeFamilyName", "Моя фамилия"], ["includeFamilyLabel", "Наша семья"], ["includeCity", "Где я живу"], ["includeAddress", "Мой адрес"],
              ].map(([key, label]) => <label className="mp-check-row" key={key}><span><strong>{label}</strong>{key === "includeAddress" && <small>Только взрослый помогает с ответом.</small>}</span><span className="mp-switch"><input type="checkbox" checked={Boolean(profile[key])} onChange={(event) => updateProfile({ [key]: event.target.checked })} /><span /></span></label>)}
            </div>
          </section>
        )}

        {tab === "order" && (
          <section className="mp-order">
            <div className="mp-section-head mp-section-head--stacked"><div><span className="mp-section-head__eyebrow">Шаг 5 из 5</span><h2>Порядок изучения</h2><p>Сначала отдельные группы людей, затем — смешанный режим.</p></div></div>
            {profile.blockOrder.map((id, index) => {
              const label = BLOCKS.find(([blockId]) => blockId === id)?.[1] ?? id;
              return <div className={`mp-order-row${id === "mix" ? " mp-order-row--mix" : ""}`} key={id}>
                <span className="mp-order-row__number">{index + 1}</span>
                <span className="mp-order-row__label">{label}{id === "mix" && <small>После остальных блоков</small>}</span>
                <label className="mp-switch"><input type="checkbox" checked={profile.enabledBlocks?.[id] !== false} onChange={(event) => updateProfile({ enabledBlocks: { ...profile.enabledBlocks, [id]: event.target.checked } })} /><span /></label>
                {id !== "mix" && <div className="mp-order-row__actions"><button type="button" disabled={index === 0} onClick={() => moveBlock(id, -1)}>↑</button><button type="button" disabled={index >= profile.blockOrder.length - 2} onClick={() => moveBlock(id, 1)}>↓</button></div>}
              </div>;
            })}
          </section>
        )}
      </main>
    </div>
  );
}
