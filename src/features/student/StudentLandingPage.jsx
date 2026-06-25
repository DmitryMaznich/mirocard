import { useState } from "react";
import "./StudentLandingPage.css";


const isIos =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export default function StudentLandingPage({ onContinue }) {
  const [opening, setOpening] = useState(false);

  function handleOpenApp() {
    setOpening(true);
    // Navigate to the app root — Chrome on Android will intercept this if the
    // PWA is installed and offer (or automatically) open it in the app.
    // sessionStorage token is preserved across same-origin navigations, so the
    // student portal will work in the browser too if Chrome doesn't intercept.
    history.replaceState(null, "", "/");
    window.location.href = "/";
  }

  function handleContinue() {
    history.replaceState(null, "", "/");
    onContinue();
  }

  return (
    <div className="slp-root">
      <div className="slp-card">
        <div className="slp-icon">📚</div>
        <div className="slp-title">Задание готово!</div>
        <div className="slp-sub">Логопед назначил тебе занятие в приложении Mirocard</div>

        <button
          className="slp-btn-primary"
          onClick={handleOpenApp}
          disabled={opening}
        >
          {opening ? "Открываем…" : "Открыть в приложении"}
        </button>

        <div className="slp-divider">Нет приложения? Установи его</div>

        {isIos ? (
          <ol className="slp-steps">
            <li><span className="slp-step-icon">①</span> Нажми кнопку <strong>«Поделиться»</strong> <span className="slp-share-icon">⬆︎</span> внизу Safari</li>
            <li><span className="slp-step-icon">②</span> Выбери <strong>«На экран Домой»</strong></li>
            <li><span className="slp-step-icon">③</span> Нажми <strong>«Добавить»</strong></li>
            <li><span className="slp-step-icon">④</span> Открой иконку <strong>Mirocard</strong> — задание будет внутри</li>
          </ol>
        ) : (
          <ol className="slp-steps">
            <li><span className="slp-step-icon">①</span> Нажми <strong>«Установить»</strong> или <strong>⋮</strong> → <strong>«Добавить на главный экран»</strong> в Chrome</li>
            <li><span className="slp-step-icon">②</span> Открой иконку <strong>Mirocard</strong> — задание будет внутри</li>
          </ol>
        )}

        <button className="slp-btn-secondary" onClick={handleContinue}>
          Продолжить в браузере →
        </button>
      </div>
    </div>
  );
}
