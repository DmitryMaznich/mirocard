/* global window, document, location, history, __APP_VERSION__ */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import { createRoot } from 'react-dom/client';
import { getDb, kv } from '../../src/core/db.js';
import { useAppStore } from '../../src/core/store.js';
import { importTopic, getTopicRecord } from '../../src/topics/topicLoader.js';
import { loadRenderer } from '../../src/topics/rendererLoader.js';
import SessionScreen from '../../src/features/session/SessionScreen.jsx';
import ParamsScreen from '../../src/features/session/ParamsScreen.jsx';
import SessionSummary from '../../src/features/session/SessionSummary.jsx';
import { TimerProvider } from '../../src/features/timer/TimerContext.jsx';
import descriptor from './topic.json';
import '../../src/styles.css';

// Development stand, never imported by the application. Use a separate browser profile.
// It installs the real ZIP and uses the same renderer loader, session, audio, stars and prize.
window.__Mirocard = { React, ReactDOM, jsxRuntime };
const q = new URLSearchParams(location.search);
const db = await getDb();
await importTopic(db, await (await fetch(`/decks/drawing_v${descriptor.meta.version}.zip`)).arrayBuffer(), __APP_VERSION__);
const record = await getTopicRecord(db, 'drawing');
await loadRenderer('drawing');
const snapshot = q.has('fresh') ? null : await kv.get(db, 'activeSession');
if (q.has('fresh')) { q.delete('fresh'); history.replaceState(null, '', `?${q}`); }
const student = { id: 'first-lines-preview', name: 'Проба', lessonFlow: { advance: q.has('auto') ? 'auto' : 'tap', delaySeconds: 1 },
  rewardSettings: { lossMode: q.get('loss') === 'all' ? 'all' : 'one', duration: '60', sound: false },
  rewardVideos: q.has('noVideo') ? [] : ['https://youtu.be/aaaaaaaaaaa'] };
useAppStore.setState({ students: [student], activeStudentId: student.id, activeTopicId: 'drawing',
  activeModeId: 'drawing_first_lines', activeTextId: null, activeLessonPlanItemId: null,
  topicRecords: [record], sessions: [], account: null, activeSessionSnapshot: snapshot,
  sessionReturnScreen: null, sessionExitPromptOpen: false, screen: q.has('params') ? 'params' : 'session',
  studentTopicLinks: { [`${student.id}_drawing`]: { selectedConceptIds: ['kompot'],
    answersPerStar: Math.max(1, Math.min(3, Number(q.get('perStar')) || 1)),
    strictStars: !q.has('soft'), videoRewardEnabled: !q.has('noVideo'),
    params: { byMode: { drawing_first_lines: { inputMode: q.has('passive') ? 'passive_pen' : q.has('touch') ? 'touch' : 'pen', preciseSelection: q.has('exercises'), exercises: q.has('exercises') ? q.get('exercises').split(',') : [], practiceSet: q.get('set') || 'mixed', workSurface: q.get('surface') || 'sheet' } } } } } });
window.previewStore = useAppStore;
function Preview() {
  const screen = useAppStore(s => s.screen);
  return React.createElement(TimerProvider, null, React.createElement(
    screen === 'params' ? ParamsScreen : screen === 'summary' ? SessionSummary : SessionScreen));
}
createRoot(document.getElementById('root')).render(React.createElement(Preview));
