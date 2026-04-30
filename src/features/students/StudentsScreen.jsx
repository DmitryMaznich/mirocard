import { useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
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
  const students    = useAppStore((s) => s.students);
  const setStudents = useAppStore((s) => s.setStudents);
  const setActiveStudentId = useAppStore((s) => s.setActiveStudentId);
  const setScreen   = useAppStore((s) => s.setScreen);

  const [showAdd,  setShowAdd]  = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [deleting, setDeleting] = useState(null);

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
  }

  async function handleEdit(data) {
    const updated = students.map((s) =>
      s.id === editing.id
        ? { ...s, ...data, updatedAt: new Date().toISOString() }
        : s
    );
    const db = await getDb();
    await persistStudents(db, updated, setStudents);
    setEditing(null);
  }

  async function handleDelete() {
    const updated = students.filter((s) => s.id !== deleting.id);
    const db = await getDb();
    await persistStudents(db, updated, setStudents);
    setDeleting(null);
  }

  function selectStudent(student) {
    setActiveStudentId(student.id);
    setScreen("home");
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}>←</button>
        <h1 className="screen-title">Ученики</h1>
        <button className="header-action-btn" onClick={() => setShowAdd(true)}>+</button>
      </div>

      {students.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__text">Учеников пока нет</div>
          <Button onClick={() => setShowAdd(true)}>Добавить ученика</Button>
        </div>
      ) : (
        <ul className="student-list">
          {students.map((student) => (
            <li key={student.id} className="student-item">
              <button className="student-item__main" onClick={() => selectStudent(student)}>
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
