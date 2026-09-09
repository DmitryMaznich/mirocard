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
    enabled: person.enabled !== false,
    createdAt: person.createdAt ?? null,
    updatedAt: person.updatedAt ?? null,
    deletedAt: person.deletedAt ?? null,
  })) : [];
}

async function resizeToDataUrl(file, maxSize = 400) {
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
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    image.src = source;
  });
}

function PersonCard({ person, onEdit, onToggle }) {
  const photo = person.photos[0] ?? null;
  return (
    <article className={`mp-person-card${person.enabled ? "" : " mp-person-card--disabled"}`}>
      <button type="button" className="mp-person-card__main" onClick={() => onEdit(person.id)}>
        {photo
          ? <img className="mp-person-card__photo" src={photo} alt="" />
          : <div className="mp-person-card__photo mp-person-card__photo--fallback">{person.type === "pet" ? "🐾" : getInitials(person.name || "?")}</div>
        }
        <span className="mp-person-card__copy">
          <strong>{person.name || "Без имени"}</strong>
          <span>{person.relation || "Связь не указана"}</span>
        </span>
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
    <section className="mp-editor">
      <div className="mp-editor__head">
        <div>
          <h2>{person.isDraft ? "Добавить человека" : "Настройки человека"}</h2>
          <p>Имя и связь с ребёнком отрабатываются отдельно.</p>
        </div>
        <button type="button" className="mp-icon-button" onClick={onClose} aria-label="Закрыть">✕</button>
      </div>

      <div className="mp-editor__photo-row">
        {person.photos[0]
          ? <img src={person.photos[0]} className="mp-editor__photo" alt="" />
          : <div className="mp-editor__photo mp-editor__photo--empty">{person.type === "pet" ? "🐾" : "📷"}</div>
        }
        <div>
          <Button variant="secondary" onClick={() => photoRef.current?.click()} disabled={uploading}>
            {uploading ? "Загружаем…" : person.photos.length ? "Добавить фото" : "Загрузить фото"}
          </Button>
          {person.photos.length > 1 && <div className="mp-editor__photo-count">Ещё фото: {person.photos.length - 1}</div>}
        </div>
        <input ref={photoRef} type="file" accept="image/*" onChange={addPhoto} hidden />
      </div>

      <label className="mp-field">
        <span>Тип</span>
        <select value={person.type} onChange={(event) => update({ type: event.target.value })}>
          <option value="person">Человек</option>
          <option value="pet">Питомец</option>
        </select>
      </label>
      <label className="mp-field">
        <span>Имя</span>
        <input value={person.name} onChange={(event) => update({ name: event.target.value })} placeholder="Например, Анна" autoFocus />
      </label>
      <label className="mp-field">
        <span>Кто это для ребёнка?</span>
        <input value={person.relation} onChange={(event) => update({ relation: event.target.value })} placeholder={person.type === "pet" ? "Например, наша кошка" : "Например, мама"} />
      </label>

      <fieldset className="mp-contexts">
        <legend>Где ребёнок встречает этого человека?</legend>
        <p>Можно выбрать несколько вариантов.</p>
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
        <span><strong>Включать в тему</strong><small>Человек будет появляться в заданиях темы.</small></span>
      </label>

      <div className="mp-editor__actions">
        {person.createdAt && <Button variant="danger" onClick={onDelete}>Удалить</Button>}
        <Button variant="primary" onClick={onClose} disabled={!person.name.trim() || !person.relation.trim() || person.contexts.length === 0}>Готово</Button>
      </div>
    </section>
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
      photos: [], enabled: true, createdAt: null, updatedAt: null, deletedAt: null, isDraft: true,
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
      .map(({ isDraft, ...person }) => ({ ...person, updatedAt: person.updatedAt ?? updatedAt }));
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
      <div className="mp-intro">
        <strong>Индивидуальная тема {student.name}</strong>
        <span>Семья, люди дома и школа — с именами, связями и фотографиями.</span>
      </div>
      <nav className="mp-tabs" aria-label="Разделы темы">
        {TABS.map(([id, label]) => <button key={id} type="button" className={tab === id ? "mp-tab mp-tab--active" : "mp-tab"} onClick={() => { setTab(id); setEditingId(null); }}>{label}</button>)}
      </nav>

      <main className="mp-body">
        {tab in CONTEXT_LABELS && (
          <>
            <div className="mp-section-head">
              <div>
                <h2>{TABS.find(([id]) => id === tab)?.[1]}</h2>
                <p>Добавьте людей с фотографиями. Имя и связь с ребёнком сохраняются отдельно.</p>
              </div>
              <Button variant="secondary" onClick={addPerson}>+ Добавить</Button>
            </div>
            <div className="mp-people-layout">
              <div className="mp-people-list">
                {visiblePeople.length
                  ? visiblePeople.map((person) => <PersonCard key={person.id} person={person} onEdit={setEditingId} onToggle={togglePerson} />)
                  : <div className="mp-empty">Здесь пока никого нет. Добавьте первого человека или питомца.</div>
                }
              </div>
              {editing && <PersonEditor person={editing} activeContext={tab} onChange={updatePerson} onDelete={() => deletePerson(editing.id)} onClose={closeEditor} />}
            </div>
          </>
        )}

        {tab === "personal" && (
          <section className="mp-personal">
            <h2>Личные данные</h2>
            <p>Добавьте только те ответы, которые хотите отрабатывать с {student.name}.</p>
            <div className="mp-form-card">
              <h3>Имя и фамилия</h3>
              <label className="mp-field"><span>Фамилия ребёнка</span><input value={profile.familyName} onChange={(event) => updateProfile({ familyName: event.target.value })} /></label>
              <label className="mp-field"><span>Как называть семью</span><input value={profile.familyLabel} onChange={(event) => updateProfile({ familyLabel: event.target.value })} placeholder="Например, семья Петровых" /></label>
              <div className="mp-note">Фамилия ребёнка и название семьи могут отличаться.</div>
            </div>
            <div className="mp-form-card">
              <h3>Где я живу</h3>
              <label className="mp-field"><span>Город</span><input value={profile.city} onChange={(event) => updateProfile({ city: event.target.value })} /></label>
              <label className="mp-field"><span>Адрес — необязательно</span><input value={profile.address} onChange={(event) => updateProfile({ address: event.target.value })} /></label>
              <div className="mp-note">Адрес используется только в заданиях этого ученика и только если вы его включили.</div>
            </div>
            <div className="mp-form-card">
              <h3>Что включать в тему</h3>
              {[
                ["includeSelfName", "Моё имя"], ["includeFamilyName", "Моя фамилия"], ["includeFamilyLabel", "Наша семья"], ["includeCity", "Где я живу"], ["includeAddress", "Мой адрес"],
              ].map(([key, label]) => <label className="mp-check-row" key={key}><input type="checkbox" checked={Boolean(profile[key])} onChange={(event) => updateProfile({ [key]: event.target.checked })} /><span><strong>{label}</strong></span></label>)}
            </div>
          </section>
        )}

        {tab === "order" && (
          <section className="mp-order">
            <h2>Порядок изучения</h2>
            <p>Сначала отдельные группы людей, затем — смешанный режим.</p>
            {profile.blockOrder.map((id, index) => {
              const label = BLOCKS.find(([blockId]) => blockId === id)?.[1] ?? id;
              return <div className="mp-order-row" key={id}>
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
