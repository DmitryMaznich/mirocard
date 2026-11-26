import { useState } from 'react';
import { useAppStore } from '@/core/store';
import { readModeParams } from '@/shared/utils/topicUtils';
import { loadTopicFileUrl } from '@/shared/hooks/useTopicFile';
import { BackArrowIcon } from '@/shared/components/ArrowIcons';
import DrawingCover from '@/topics/renderers/drawing/DrawingCover';
import '@/topics/renderers/drawing/drawing.css';
import './drawingLaunch.css';
import ParamsScreen from './ParamsScreen';

export default function DrawingLaunchScreen() {
  const topicId = useAppStore(s => s.activeTopicId), studentId = useAppStore(s => s.activeStudentId);
  const modeId = useAppStore(s => s.activeModeId), records = useAppStore(s => s.topicRecords);
  const links = useAppStore(s => s.studentTopicLinks), returnScreen = useAppStore(s => s.sessionReturnScreen);
  const setScreen = useAppStore(s => s.setScreen);
  const setReturnScreen = useAppStore(s => s.setSessionReturnScreen);
  const topic = records.find(record => record.meta.id === topicId), mode = topic?.modes.find(mode => mode.id === modeId);
  const cards = topic?.cards?.filter(card => card.lesson?.steps?.length) ?? [];
  const [selected, setSelected] = useState(() => returnScreen === 'session'
    ? readModeParams(links[`${studentId}_${topicId}`]?.params, mode).drawingCardId : null);
  const card = cards.find(card => card.id === selected);
  if (card) return <ParamsScreen drawingCard={card} onDrawingBack={() => { setSelected(null); setReturnScreen(null); }} />;
  return <section className="screen drawing-launch-picker" aria-label="Выбор рисунка">
    <div className="screen-header"><button className="back-btn" aria-label="Назад к режимам" onClick={() => setScreen('modes')}><BackArrowIcon /></button><h1 className="screen-title">Выберите рисунок</h1></div>
    <div className="drawing-cards">{cards.map(card => <button type="button" className="drawing-card" key={card.id} onClick={() => setSelected(card.id)}>
      <DrawingCover card={card} loadTopicFileUrl={loadTopicFileUrl} topicId={topicId} /><span>{card.label ?? card.lesson.title}</span>
    </button>)}</div>
    {!cards.length && <p>В этой теме пока нет рисунков.</p>}
  </section>;
}
