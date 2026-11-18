import { useEffect, useState } from 'react';

export default function DrawingPreparation({ title, onStart }) {
  const [portrait, setPortrait] = useState(() => globalThis.matchMedia?.('(orientation: portrait)').matches ?? true);
  useEffect(() => {
    const media = globalThis.matchMedia?.('(orientation: portrait)');
    if (!media) return undefined;
    const update = () => setPortrait(media.matches);
    update();
    if (media.addEventListener) media.addEventListener('change', update);
    else media.addListener(update);
    return () => { if (media.removeEventListener) media.removeEventListener('change', update); else media.removeListener(update); };
  }, []);
  return <section className="drawing-lesson drawing-preparation" aria-label={`Подготовка: ${title}`}>
    <h2>Подготовься к рисованию</h2><p>{title}</p>
    <div className="drawing-preparation__cards">
      <div className="drawing-preparation__card">
        <svg viewBox="0 0 220 150" role="img" aria-label="Лист лежит горизонтально">
          <rect x="22" y="23" width="180" height="114" rx="8" fill="#e5e5d9" />
          <rect x="17" y="17" width="180" height="114" rx="8" fill="#fffefa" stroke="#65887a" strokeWidth="3" />
          <path d="M40 116H174M40 116L46 111M40 116L46 121M174 116L168 111M174 116L168 121" fill="none" stroke="#28655a" strokeWidth="2" strokeLinecap="round" />
        </svg><h3>Поверни лист вот так</h3><p>Положи тетрадь или альбомный лист горизонтально.</p>
      </div>
      {portrait && <div className="drawing-preparation__card" data-preparation-phone>
        <svg viewBox="0 0 200 150" role="img" aria-label="Поверни телефон горизонтально">
          <g className="drawing-preparation__phone"><rect x="69" y="22" width="62" height="106" rx="12" fill="#e1ece5" stroke="#28655a" strokeWidth="3" /><rect x="76" y="34" width="48" height="76" rx="4" fill="#fffefa" /><path d="M91 28H109" stroke="#28655a" strokeWidth="3" strokeLinecap="round" /><circle cx="100" cy="119" r="3" fill="#28655a" /></g>
          <path d="M147 44Q169 68 146 94M146 94L148 82M146 94L158 92" fill="none" stroke="#c6a33a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg><h3>Поверни экран</h3><p>Так рисунок будет крупнее. Можно рисовать и сейчас.</p>
      </div>}
    </div>
    <button type="button" className="drawing-preparation__start" onClick={onStart}>Начать рисовать</button>
  </section>;
}
