import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useState } from "react";
import { useAppStore } from "@/core/store";
import { BackArrowIcon, ChevronRightIcon } from "@/shared/components/ArrowIcons";

const SUPPORT_EMAIL = "hello@mironium.com";

// Grounded in what the app actually does today — no answer here describes a
// feature that isn't shipped.


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
  const { t: tr } = useUiTranslation();
  const FAQ_ITEMS = [
    {
      q: tr("help.studentQuestion"),
      a: tr("help.studentAnswer"),
    },
    {
      q: tr("help.modeQuestion"),
      a: tr("help.modeAnswer"),
    },
    {
      q: tr("help.dataQuestion"),
      a: tr("help.dataAnswer"),
      linkScreen: "privacy",
      linkLabel: tr("help.openPrivacy"),
    },
    {
      q: tr("help.emailQuestion"),
      a: tr("help.emailAnswer", { email: SUPPORT_EMAIL }),
    },
    {
      q: tr("help.passwordQuestion"),
      a: tr("help.passwordAnswer"),
    },
    {
      q: tr("help.multipleQuestion"),
      a: tr("help.multipleAnswer"),
    },
  ];

  const setScreen = useAppStore((s) => s.setScreen);
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">{tr("nav.help")}</h1>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-section-title">{tr("help.questions")}</div>
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
          <p className="help-contact__title">{tr("help.noAnswer")}</p>
          <p className="help-contact__hint">{tr("help.contactHint")}</p>
          <a className="btn btn-primary" href={`mailto:${SUPPORT_EMAIL}`}>{tr("help.contact")}</a>
        </div>
      </div>
    </div>
  );
}
