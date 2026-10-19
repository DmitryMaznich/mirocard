import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import "./StudentDataInfo.css";

export default function StudentDataInfo({ kind }) {
  const { t } = useUiTranslation();
  const EXPLANATIONS = {
    profile: {
      title: t("students.namePhoto"),
      text: t("studentInfo.profile"),
    },
    notes: {
      title: t("students.notes"),
      text: t("studentInfo.notes"),
    },
    sex: {
      title: t("students.sex"),
      text: t("studentInfo.sex"),
    },
    language: {
      title: t("students.language"),
      text: t("studentInfo.language"),
    },
    people: {
      title: t("students.people"),
      text: t("studentInfo.people"),
    },
    dates: {
      title: t("students.dates"),
      text: t("studentInfo.dates"),
    },
    adults: {
      title: t("students.people"),
      text: t("studentInfo.adults"),
    },
    videos: {
      title: t("students.videos"),
      text: t("studentInfo.videos"),
    },
    age: {
      title: t("studentInfo.ageTitle"),
      text: t("studentInfo.age"),
    },
    identity: {
      title: t("studentInfo.identityTitle"),
      text: t("studentInfo.identity"),
    },
    address: {
      title: t("studentInfo.addressTitle"),
      text: t("studentInfo.address"),
    },
  };


  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const dialog = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const info = EXPLANATIONS[kind];

  useEffect(() => {
    if (!open) return;
    const modal = dialog.current.querySelector('[role="dialog"]');
    modal.setAttribute("aria-labelledby", titleId);
    modal.setAttribute("aria-describedby", descriptionId);
    modal.querySelector("button")?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === "Tab") {
        const buttons = [...modal.querySelectorAll("button")];
        const first = buttons[0];
        const last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    const opener = trigger.current;
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      opener?.focus();
    };
  }, [open, titleId, descriptionId]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="student-data-info"
        aria-label={t("studentInfo.label", { title: info.title })}
        aria-haspopup="dialog"
        onClick={(event) => { event.preventDefault(); setOpen(true); }}
      >
        <span aria-hidden="true">{t("studentInfo.why")}</span>
      </button>
      {open && createPortal(
        <div ref={dialog} className="student-data-info-dialog">
          <Modal
            title={<span id={titleId}>{info.title}</span>}
            onClose={() => setOpen(false)}
            actions={<Button variant="primary" onClick={() => setOpen(false)}>{t("common.understood")}</Button>}
          >
            <p id={descriptionId} className="student-data-info-text">{info.text}</p>
          </Modal>
        </div>,
        document.body,
      )}
    </>
  );
}
