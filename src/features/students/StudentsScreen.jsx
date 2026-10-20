import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useState } from "react";
import { languageName } from "../../../shared/languages.mjs";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import AuthenticatedImage from "@/shared/components/AuthenticatedImage";
import { formatDate, getInitials } from "@/shared/utils/format";
import { BackArrowIcon, ChevronRightIcon } from "@/shared/components/ArrowIcons";

async function persistStudents(db, students, setStudents) {
  await kv.set(db, "students", students);
  setStudents(students);
}

export default function StudentsScreen() {
  const { t } = useUiTranslation();
  const students           = useAppStore((s) => s.students);
  const setStudents        = useAppStore((s) => s.setStudents);
  const setActiveStudentId = useAppStore((s) => s.setActiveStudentId);
  const setEditingStudentId = useAppStore((s) => s.setEditingStudentId);
  const setScreen          = useAppStore((s) => s.setScreen);

  const [deleting,       setDeleting]       = useState(null);
  const [panelStudentId, setPanelStudentId] = useState(null);

  const panelStudent = students.find((s) => s.id === panelStudentId) ?? null;

  async function handleDelete() {
    const deletingId = deleting.id;
    const updated = students.filter((s) => s.id !== deletingId);
    const db = await getDb();
    await persistStudents(db, updated, setStudents);
    if (panelStudentId === deletingId) setPanelStudentId(null);
    setDeleting(null);
    pushOp("student.delete", { id: deletingId });
  }

  function openAdd() {
    setEditingStudentId(null);
    setScreen("student_edit");
  }

  function openEdit(student) {
    setEditingStudentId(student.id);
    setScreen("student_edit");
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
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">{t("nav.students")}</h1>
        <button className="header-action-btn" onClick={openAdd}>+</button>
      </div>

      <div className="students-layout">
        {/* Left: student list */}
        <div className="students-sidebar">
          {students.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__text">{t("students.empty")}</div>
              <Button onClick={openAdd}>{t("students.add")}</Button>
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
                    {student.photo
                      ? <AuthenticatedImage src={student.photo} className="student-avatar student-avatar--photo" alt="" />
                      : <div className="student-avatar">{getInitials(student.name)}</div>
                    }
                    <div className="student-info">
                      <div className="student-name">{student.name}</div>
                      {student.comment && (
                        <div className="student-comment">{student.comment}</div>
                      )}
                      <div className="student-meta">
                        {t("students.added", { date: formatDate(student.createdAt) })}
                      </div>
                    </div>
                  </button>
                  <div className="student-item__actions">
                    <button className="icon-btn" aria-label={t("students.statisticsFor", { name: student.name })} title={t("nav.statistics")} onClick={() => { setActiveStudentId(student.id); setScreen("history"); }}>▥</button>
                    <button className="icon-btn" onClick={() => openEdit(student)}>✎</button>
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
            {panelStudent.photo
              ? <AuthenticatedImage src={panelStudent.photo} className="student-detail-avatar student-detail-avatar--photo" alt="" />
              : <div className="student-detail-avatar">{getInitials(panelStudent.name)}</div>
            }
            <div className="student-detail-name">{panelStudent.name}</div>
            {panelStudent.comment && (
              <div className="student-detail-comment">{panelStudent.comment}</div>
            )}
            <div className="student-detail-meta">
              {t("students.added", { date: formatDate(panelStudent.createdAt) })}
            </div>
            {panelStudent.primaryLanguage && (
              <div className="student-detail-lang">
                {languageName(panelStudent.primaryLanguage)}
              </div>
            )}
            {(panelStudent.rewardVideos?.length ?? 0) > 0 && (
              <div className="student-detail-meta">
                🎬 {t("students.videoCount", { count: panelStudent.rewardVideos.length })}
              </div>
            )}
            <div className="student-detail-actions">
              <Button variant="secondary" fullWidth onClick={() => { setActiveStudentId(panelStudent.id); setScreen("history"); }}>{t("nav.statistics")}</Button>
              <Button
                fullWidth
                onClick={() => { setActiveStudentId(panelStudent.id); setScreen("home"); }}
              >{t("common.select")}<ChevronRightIcon size={14} />
              </Button>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="secondary" fullWidth onClick={() => openEdit(panelStudent)}>{t("common.edit")}</Button>
                <Button variant="danger" onClick={() => setDeleting(panelStudent)}>✕</Button>
              </div>
            </div>
          </div>
        ) : students.length > 0 ? (
          <div className="students-detail-panel students-detail-panel--empty">
            <div className="students-detail-empty-text">{t("students.selectDetails")}</div>
          </div>
        ) : null}
      </div>

      {deleting && (
        <Modal
          title={t("students.deleteTitle")}
          onClose={() => setDeleting(null)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setDeleting(null)}>{t("common.cancel")}</Button>
              <Button variant="danger" onClick={handleDelete}>{t("common.delete")}</Button>
            </>
          }
        >{t("students.deleteConfirm", { name: deleting.name })}
        </Modal>
      )}
    </div>
  );
}
