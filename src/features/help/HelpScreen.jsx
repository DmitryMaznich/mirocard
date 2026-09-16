import { useState } from "react";
import { useAppStore } from "@/core/store";
import { BackArrowIcon, ChevronRightIcon } from "@/shared/components/ArrowIcons";

const SUPPORT_EMAIL = "hello@mironium.com";

// Grounded in what the app actually does today — no answer here describes a
// feature that isn't shipped.
const FAQ_ITEMS = [
  {
    q: "Что такое «ученик» и зачем его добавлять?",
    a: "Ученик — это ребёнок (или взрослый), с которым вы занимаетесь. У каждого ученика — своя тема, свой прогресс и своя история занятий. Добавить ученика можно через меню (значок ☰ на главном экране) → «Ученики» — достаточно указать имя.",
  },
  {
    q: "Как поменять тему или режим занятия?",
    a: "На главном экране нажмите на карточку «Тема» или «Режим» — откроется список для выбора. Пунктирная рамка на карточке означает, что тема или режим подставлены по умолчанию и вы их ещё не выбирали сами — нажмите, чтобы выбрать свои.",
  },
  {
    q: "Где хранятся данные о моём ученике и кто их видит?",
    a: "Имя, фото и история занятий ученика хранятся на защищённом сервере и доступны только вашему аккаунту.",
    linkScreen: "privacy",
    linkLabel: "Открыть политику конфиденциальности",
  },
  {
    q: "Я не получил письмо с подтверждением почты — что делать?",
    a: `Проверьте папку «Спам» — иногда такие письма попадают туда. Если письма всё ещё нет, напишите нам на ${SUPPORT_EMAIL} с адресом, который указывали при регистрации, — подтвердим аккаунт вручную.`,
  },
  {
    q: "Я забыл(а) пароль — как его восстановить?",
    a: "На экране входа нажмите «Забыли пароль?» и укажите email аккаунта — придёт ссылка для сброса пароля.",
  },
  {
    q: "Можно ли вести несколько учеников на одном аккаунте?",
    a: "Да. Добавьте ещё одного ученика через меню → «Ученики» — переключаться между ними можно там же.",
  },
];

function FaqItem({ item, isOpen, onToggle, onOpenLink }) {
  return (
    <div className={`faq-item${isOpen ? " faq-item--open" : ""}`}>
      <button type="button" className="faq-item__q" onClick={onToggle}>
        <span>{item.q}</span>
        <span className="faq-item__chevron"><ChevronRightIcon size={16} /></span>
      </button>
      {isOpen && (
        <div className="faq-item__a">
          <p>{item.a}</p>
          {item.linkScreen && (
            <button type="button" className="faq-item__link" onClick={() => onOpenLink(item.linkScreen)}>
              {item.linkLabel} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function HelpScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">Помощь и поддержка</h1>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-section-title">Частые вопросы</div>
          <div className="faq-list">
            {FAQ_ITEMS.map((item, i) => (
              <FaqItem
                key={item.q}
                item={item}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
                onOpenLink={setScreen}
              />
            ))}
          </div>
        </div>

        <div className="help-contact">
          <p className="help-contact__title">Не нашли ответ?</p>
          <p className="help-contact__hint">
            Напишите нам о баге или вопросе — постарайтесь описать, что делали и что пошло не так,
            это поможет быстрее разобраться.
          </p>
          <a className="btn btn-primary" href={`mailto:${SUPPORT_EMAIL}`}>
            Написать в поддержку
          </a>
        </div>
      </div>
    </div>
  );
}
