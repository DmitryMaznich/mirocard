import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import "./StudentDataInfo.css";

const EXPLANATIONS = {
  profile: {
    title: "Имя и фото",
    text: "Имя и фото помогают узнавать ученика в списке профилей. В теме «Мои люди» имя используется для вопроса «Как тебя зовут?», а фото — как подсказка в заданиях о себе. Фото добавлять необязательно.",
  },
  notes: {
    title: "Заметки",
    text: "Здесь можно записать цели занятий и особенности, которые важно помнить взрослому. Заметки сохраняются в профиле, чтобы к ним можно было вернуться. Заполняйте их только при необходимости.",
  },
  sex: {
    title: "Пол",
    text: "В теме «Мои люди» эти данные задают ответ на вопрос «Ты мальчик или девочка?». Так ученик учится рассказывать о себе. Если оставить «Не указан», этот вопрос не появится.",
  },
  language: {
    title: "Язык",
    text: "Это основной язык ученика. Он отображается в профиле и помогает взрослому помнить, на каком языке ученик общается. Можно оставить «Не задан».",
  },
  people: {
    title: "Мои люди",
    text: "Имена, фотографии и связи с близкими людьми нужны для индивидуальных заданий о семье, доме и школе. Ученик тренируется узнавать знакомых людей, называть их и рассказывать, кем они ему приходятся. Добавляйте тех, кого хотите включить в занятия.",
  },
  dates: {
    title: "Важные даты",
    text: "Дни рождения, праздники и другие события используются на экране «Сегодня». Они помогают связывать календарь с понятными ученику событиями и обсуждать, что происходит сегодня или скоро. Добавлять даты необязательно.",
  },
  adults: {
    title: "Близкие взрослые",
    text: "Имена и фото знакомых взрослых используются в заданиях на составление предложений и в настройках общения. Они помогают работать с понятными ученику людьми — например, с мамой или папой. Добавляйте только нужных для этих занятий взрослых.",
  },
  videos: {
    title: "Видео-награды",
    text: "Ссылки на любимые видео нужны для поощрения во время занятий. Когда предлагается видео-награда, приложение использует видео из этого списка. Подберите подходящие ученику ролики; добавлять их необязательно.",
  },
  age: {
    title: "Возраст и дата рождения",
    text: "По дате рождения приложение само вычисляет возраст для вопроса «Сколько тебе лет?» в теме «Мои люди». Ответ обновляется с возрастом ученика, поэтому его не нужно менять вручную. Если дату не заполнить, этот вопрос не появится.",
  },
  identity: {
    title: "Имя и фамилия",
    text: "Имя и фамилия используются в теме «Мои люди», чтобы ученик учился представляться и отвечать на вопросы о себе. Название семьи сохраняется отдельно от фамилии ребёнка. В разделе «Что включать в тему» можно выбрать ответы для занятий.",
  },
  address: {
    title: "Где я живу",
    text: "Город используется для вопроса «Где ты живёшь?» в теме «Мои люди», если включить этот ответ в занятия. Адрес — необязательная личная запись, к которой взрослый может обращаться при обучении. Заполняйте только нужные данные; с адресом помогает взрослый.",
  },
};

export default function StudentDataInfo({ kind }) {
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
        aria-label={`Зачем нужны данные: ${info.title}`}
        aria-haspopup="dialog"
        onClick={(event) => { event.preventDefault(); setOpen(true); }}
      >
        <span aria-hidden="true">i</span>
      </button>
      {open && createPortal(
        <div ref={dialog} className="student-data-info-dialog">
          <Modal
            title={<span id={titleId}>{info.title}</span>}
            onClose={() => setOpen(false)}
            actions={<Button variant="primary" onClick={() => setOpen(false)}>Понятно</Button>}
          >
            <p id={descriptionId} className="student-data-info-text">{info.text}</p>
          </Modal>
        </div>,
        document.body,
      )}
    </>
  );
}
