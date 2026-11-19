import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import AuthenticatedImage from "@/shared/components/AuthenticatedImage";
import { CheckmarkIcon } from "@/shared/components/ArrowIcons";
import { getInitials } from "@/shared/utils/format";

// New interface: tapping the student in the Home header switches who the
// lesson is for — a daily action for a family with two children or a
// specialist, which used to be three taps deep (menu → Ученики → row).
export default function StudentSwitcherSheet({ students, activeId, onPick, onAdd, onAll, onClose }) {
  const { t } = useUiTranslation();
  return (
    <div className="action-sheet-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="action-sheet student-switcher" role="dialog" aria-modal="true" aria-label={t("preview.whoStudies")}>
        <div className="action-sheet__title">{t("preview.whoStudies")}</div>
        {students.map((student) => {
          const current = student.id === activeId;
          return (
            <button key={student.id} type="button" className={`action-sheet__item student-switcher__item${current ? " student-switcher__item--current" : ""}`}
              aria-current={current ? "true" : undefined} onClick={() => { onPick(student.id); onClose(); }}>
              <span className="student-switcher__avatar" aria-hidden="true">
                {student.photo ? <AuthenticatedImage src={student.photo} alt="" /> : getInitials(student.name)}
              </span>
              <span className="student-switcher__name">{student.name}</span>
              {current && <CheckmarkIcon size={18} />}
            </button>
          );
        })}
        <button type="button" className="action-sheet__item student-switcher__add" onClick={() => { onAdd(); onClose(); }}>+ {t("students.add")}</button>
        <button type="button" className="action-sheet__item" onClick={() => { onAll(); onClose(); }}>{t("preview.allStudents")}</button>
        <button type="button" className="action-sheet__item action-sheet__item--cancel" onClick={onClose}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}
