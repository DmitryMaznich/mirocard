import { useMemo, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import Button from "@/shared/components/Button";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { getInitials } from "@/shared/utils/format";

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

// A person can fill an entire task card. Keep a retina-quality source rather
// than the tiny thumbnail-sized copy used in early prototypes.
const PERSON_PHOTO_MAX_SIZE = 1600;
const PERSON_PHOTO_JPEG_QUALITY = 0.92;

async function resizeToDataUrl(file, maxSize = PERSON_PHOTO_MAX_SIZE) {
  return new Promise((resolve) => {
    const image = new Image();
    const source = URL.createObjectURL(file);
    image.onload = () => {
      const side = Math.min(image.width, image.height);
      const target = Math.min(side, maxSize);
      const canvas = document.createElement("canvas");
      canvas.width = target;
      canvas.height = target;
      canvas.getContext("2d").drawImage(
        image,
        (image.width - side) / 2,
        (image.height - side) / 2,
        side,
        side,
        0,
        0,
        target,
        target,
      );
      URL.revokeObjectURL(source);
      resolve(canvas.toDataURL("image/jpeg", PERSON_PHOTO_JPEG_QUALITY));
    };
    image.src = source;
  });
}

function PersonCard({ person, onEdit, onToggle }) {
  const photo = person.photos[0] ?? null;
  const places = person.contexts.map((context) => CONTEXT_LABELS[context]).filter(Boolean).join(" · ");
  return (
    <article className={`mp-person-card${person.enabled ? "" : " mp-person-card--disabled"}`}>
      <button type="button" className="mp-person-card__main" onClick={() => onEdit(person.id)}>
        {photo
          ? <img className="mp-person-card__photo" src={photo} alt="" />
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
      <label className="mp-switch" title="Включать в тему">
        <input type="checkbox" checked={person.enabled} onChange={() => onToggle(person.id)} />
        <span />
      </label>
    </article>
  );
}

function PersonEditor({ person, activeContext, onChange, onDelete, onClose }) {
  const photoRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function addPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const photo = await resizeToDataUrl(file);
    onChange({ ...person, photos: [...person.photos, photo] });
    setUploading(false);
    event.target.value = "";
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
          {person.photos[0]
            ? <img src={person.photos[0]} className="mp-editor__photo" alt="" />
            : <div className="mp-editor__photo mp-editor__photo--empty">{person.type === "pet" ? "🐾" : "📷"}</div>
          }
          <div className="mp-editor__photo-copy">
            <strong>{person.photos.length ? "Фотографии добавлены" : "Добавьте фотографию"}</strong>
            <span>{person.photos.length ? `${person.photos.length} ${person.photos.length === 1 ? "фото" : "фото"} · можно добавить ещё` : "На фото человек должен быть хорошо виден."}</span>
            <Button variant="secondary" onClick={() => photoRef.current?.click()} disabled={uploading}>
              {uploading ? "Готовим фото…" : person.photos.length ? "+ Ещё фото" : "Выбрать фото"}
            </Button>
          </div>
          <input ref={photoRef} type="file" accept="image/*" onChange={addPhoto} hidden />
        </div>

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
          <input type="checkbox" checked={person.enabled} onChange={(event) => update({ enabled: event.target.checked })} />
          <span><strong>Включать в тему</strong><small>Человек будет появляться в заданиях и в миксе.</small></span>
        </label>

        <div className="mp-editor__actions">
          {person.createdAt && <Button variant="danger" onClick={onDelete}>Удалить</Button>}
          <Button variant="primary" onClick={onClose} disabled={!person.name.trim() || !person.relation.trim() || person.contexts.length === 0}>Готово</Button>
        </div>
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
  const [saving, setSaving] = useState(false);

  const editing = editingId ? people.find((person) => person.id === editingId) ?? null : null;
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

  function goBack() { setScreen("student_edit"); }
  function updateProfile(patch) { setProfile((current) => ({ ...current, ...patch })); }
  function updatePerson(nextPerson) {
    const now = new Date().toISOString();
    const stamped = { ...nextPerson, updatedAt: now, createdAt: nextPerson.createdAt ?? now };
    setPeople((current) => current.map((person) => person.id === stamped.id ? stamped : person));
  }
  function addPerson() {
    const person = {
      id: makeId(), type: "person", name: "", relation: "", contexts: tab in CONTEXT_LABELS ? [tab] : ["family"],
      photos: [], introducedAxes: [], enabled: true, createdAt: null, updatedAt: null, deletedAt: null, isDraft: true,
    };
    setPeople((current) => [...current, person]);
    setEditingId(person.id);
  }
  function deletePerson(id) {
    const now = new Date().toISOString();
    setPeople((current) => current.map((person) => person.id === id ? { ...person, deletedAt: now, updatedAt: now } : person));
    setEditingId(null);
  }
  function togglePerson(id) {
    const person = people.find((item) => item.id === id);
    if (person) updatePerson({ ...person, enabled: !person.enabled });
  }

  function closeEditor() {
    const person = people.find((item) => item.id === editingId);
    if (person?.isDraft && !person.name.trim() && !person.photos.length) {
      setPeople((current) => current.filter((item) => item.id !== person.id));
    }
    setEditingId(null);
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

  async function save() {
    if (!student) return;
    setSaving(true);
    const updatedAt = new Date().toISOString();
    const nextProfile = { ...profile, updatedAt };
    const nextPeople = people
      .filter((person) => !person.isDraft || person.name.trim() || person.photos.length)
      .map((person) => {
        const savedPerson = { ...person };
        delete savedPerson.isDraft;
        return { ...savedPerson, updatedAt: savedPerson.updatedAt ?? updatedAt };
      });
    const updated = {
      ...student,
      myPeopleProfile: nextProfile,
      myPeopleProfileUpdatedAt: updatedAt,
      myPeople: nextPeople,
      myPeopleUpdatedAt: updatedAt,
    };
    const nextStudents = students.map((item) => item.id === student.id ? updated : item);
    const db = await getDb();
    await kv.set(db, "students", nextStudents);
    setStudents(nextStudents);
    await Promise.all([
      pushOp("student.my_people_profile.upsert", { studentId: student.id, profile: nextProfile, updatedAt }),
      pushOp("student.my_people.upsert", { studentId: student.id, people: nextPeople, updatedAt }),
    ]);
    setSaving(false);
    goBack();
  }

  if (!student) {
    return <div className="screen-center">Сначала сохраните ученика.</div>;
  }

  return (
    <div className="screen mp-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={goBack}><BackArrowIcon /></button>
        <h1 className="screen-title">Мои люди</h1>
        <button className="se-save-btn" onClick={save} disabled={saving}>{saving ? "…" : "Сохранить"}</button>
      </div>
      <section className="mp-intro">
        <span className="mp-intro__icon" aria-hidden="true">◎</span>
        <div>
          <strong>Индивидуальная тема {student.name}</strong>
          <span>Семья, дом, школа — с фотографиями, именами и связями.</span>
        </div>
        <span className="mp-intro__sync">Встроена в Мирониум</span>
      </section>
      <nav className="mp-tabs" aria-label="Разделы темы">
        {TABS.map(([id, label], index) => {
          const cardCount = peopleByContext[id] || 0;
          const introduction = introductionsByContext[id];
          const hint = id in CONTEXT_LABELS
            ? `${cardCount} ${cardCount === 1 ? "карточка" : "карточек"}${cardCount && introduction.total ? ` · Знакомство: ${introduction.introduced} из ${introduction.total}` : ""}`
            : id === "personal" ? "Фамилия и адрес" : "Режимы занятия";
          return (
            <button key={id} type="button" className={tab === id ? "mp-tab mp-tab--active" : "mp-tab"} onClick={() => { setTab(id); setEditingId(null); }}>
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
              <button type="button" className="mp-add-compact" onClick={addPerson}>+ Добавить</button>
            </div>
            <div className="mp-people-layout">
              <div className="mp-people-list">
                {visiblePeople.length
                  ? visiblePeople.map((person) => <PersonCard key={person.id} person={person} onEdit={setEditingId} onToggle={togglePerson} />)
                  : <div className="mp-empty"><span className="mp-empty__art" aria-hidden="true">＋</span><strong>Здесь пока никого нет</strong><span>{tab === "family" ? "Добавьте первого близкого человека или питомца." : "Добавьте человека, который встречается с ребёнком в этом окружении."}</span><button type="button" onClick={addPerson}>Добавить карточку</button></div>
                }
              </div>
              {editing && <PersonEditor person={editing} activeContext={tab} onChange={updatePerson} onDelete={() => deletePerson(editing.id)} onClose={closeEditor} />}
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
