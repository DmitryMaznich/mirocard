import React from 'react';
import { createRoot } from 'react-dom/client';
import Renderer from '../../src/topics/renderers/word_formation/index.jsx';
import SessionHeader from '../../src/features/session/SessionHeader.jsx';
import '../../src/styles.css';
const root = createRoot(document.getElementById('root'));
window.mountTask = (task) => {
  const evaluation = task.type === 'pair_intro' || task.type === 'season_overview' ? 'none' : 'auto';
  root.render(<div className="session-screen">
    <div className={`session-header-wrap${evaluation === 'none' ? ' session-header-wrap--compact' : ''}`}>
      <SessionHeader topicTitle="Словообразование" modeTitle="Выбери правильную форму" evaluation={evaluation} showProgress showStreak={evaluation !== 'none'} streakCount={2} answersPerStar={5} taskIndex={0} total={12} correctCount={0} incorrectCount={0} onClose={() => {}} onOpenModeSettings={() => {}} />
    </div>
    <div className="session-renderer-wrap"><Renderer key={JSON.stringify(task)} task={task} topicId="responsive-fixture" onCorrect={() => {}} onIncorrect={() => {}} onAdvance={() => {}} onPrevious={() => {}} /></div>
  </div>);
};
