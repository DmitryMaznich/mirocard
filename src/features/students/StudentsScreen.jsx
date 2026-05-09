import { useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import StudentForm from "./StudentForm";
import { formatDate, getInitials } from "@/shared/utils/format";

function generateStudentId() {
  return "student_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

async function persistStudents(db, students, setStudents) {
  await kv.set(db, "students", students);
  setStudents(students);
}

export default function StudentsScreen() {
  const students           = useAppStore((s) => s.students);
  const setStudents        = useAppStore((s) => s.setStudents);
  const setActiveStudentId = useAppStore((s) => s.setActiveStudentId);
  const setScreen          = useAppStore((s) => s.setScreen);

  const [showAdd,        setShowAdd]        = useState(false);
  const [editing,        setEditing]        = useState(null);
  const [deleting,       setDeleting]       = useState(null);
  const [panelStudentId, setPanelStudentId] = useState(null);

  const panelStudent = students.find((s) => s.id === panelStudentId) ?? null;

  async function handleAdd(data) {
    const student = {
      id: generateStudentId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...students, student];
    const db = await getDb();
    await persistStudents(db, updated, setStudents);
    setShowAdd(false);
    setPanelStudentId(student.id);
    pushOp("student.upsert", student);
  }

  async function handleEdit(data) {
    const updatedStudent = { ...editing, ...data, updatedAt: new Date().toISOString() };
    const updated = students.map((s) => s.id === editing.id ? updatedStudent : s);
    const db = await getDb();
    await persistStudents(db, updated, setStudents);
    setEditing(null);
    pushOp("student.upsert", updatedStudent);
  }

  async function handleDelete() {
    const deletingId = deleting.id;
    const updated = students.filter((s) => s.id !== deletingId);
    const db = await getDb();
    await persistStudents(db, updated, setStudents);
    if (panelStudentId === deletingId) setPanelStudentId(null);
    setDeleting(null);
    pushOp("student.delete", { id: deletingId });
  }

  function handleStudentClick(student) {
    if (window.innerWidth >= 768) {
      setPanelStudentId(student.id);
    } else {
      setActiveStudentId(student.id);
      setScreen("home");
    }
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}>←</button>
        <h1 className="screen-title">Ученики</h1>
        <button className="header-action-btn" onClick={() => { setShowAdd(true); }}>+</button>
      </div>

      <div className="students-layout">
        {/* Left: student list */}
        <div className="students-sidebar">
          {students.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__text">Учеников пока нет</div>
              <Button onClick={() => setShowAdd(true)}>Добавить ученика</Button>
            </div>
          ) : (
            <ul className="student-list">
              {students.map((student) => (
                <li
                  key={student.id}
                  className={`student-item${panelStudentId === student.id ? " student-item--selected" : ""}`}
                >
                  <button
                    className="student-item__main"
                    onClick={() => handleStudentClick(student)}
                  >
                    <div className="student-avatar">{getInitials(student.name)}</div>
                    <div className="student-info">
                      <div className="student-name">{student.name}</div>
                      {student.comment && (
                        <div className="student-comment">{student.comment}</div>
                      )}
                      <div className="student-meta">
                        Добавлен {formatDate(student.createdAt)}
                      </div>
                    </div>
                  </button>
                  <div className="student-item__actions">
                    <button className="icon-btn" onClick={() => setEditing(student)}>✎</button>
                    <button className="icon-btn icon-btn--danger" onClick={() => setDeleting(student)}>✕</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: detail panel (tablet only via CSS) */}
        {panelStudent ? (
          <div className="students-detail-panel">
            <div className="student-detail-avatar">{getInitials(panelStudent.name)}</div>
            <div className="student-detail-name">{panelStudent.name}</div>
            {panelStudent.comment && (
              <div className="student-detail-comment">{panelStudent.comment}</div>
            )}
            <div className="student-detail-meta">
              Добавлен {formatDate(panelStudent.createdAt)}
            </div>
            {panelStudent.primaryLanguage && (
              <div className="student-detail-lang">
                {panelStudent.primaryLanguage === "ru" ? "Русский" : "English"}
              </div>
            )}
            {(panelStudent.rewardVideos?.length ?? 0) > 0 && (
              <div className="student-detail-meta">
                🎬 {panelStudent.rewardVideos.length} видео-{panelStudent.rewardVideos.length === 1 ? "награда" : "награды"}
              </div>
            )}
            <div className="student-detail-actions">
              <Button
                fullWidth
                onClick={() => { setActiveStudentId(panelStudent.id); setScreen("home"); }}
              >
                Выбрать →
              </Button>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="secondary" fullWidth onClick={() => setEditing(panelStudent)}>
                  Редактировать
                </Button>
                <Button variant="danger" onClick={() => setDeleting(panelStudent)}>✕</Button>
              </div>
            </div>
          </div>
        ) : students.length > 0 ? (
          <div className="students-detail-panel students-detail-panel--empty">
            <div className="students-detail-empty-text">Выберите ученика<br/>чтобы открыть настройки</div>
          </div>
        ) : null}
      </div>

      {showAdd && (
        <Modal title="Новый ученик" onClose={() => setShowAdd(false)}>
          <StudentForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
        </Modal>
      )}

      {editing && (
        <Modal title="Редактировать" onClose={() => setEditing(null)}>
          <StudentForm initial={editing} onSave={handleEdit} onCancel={() => setEditing(null)} />
        </Modal>
      )}

      {deleting && (
        <Modal
          title="Удалить ученика?"
          onClose={() => setDeleting(null)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setDeleting(null)}>Отмена</Button>
              <Button variant="danger" onClick={handleDelete}>Удалить</Button>
            </>
          }
        >
          Удалить <strong>{deleting.name}</strong>? История сессий будет утеряна.
        </Modal>
      )}
    </div>
  );
}
