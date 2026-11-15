// «Портрет по кубику»: the whole lesson state, kept on the device so a reload continues the portrait.
import { STYLES, normalizeStyle } from './styles.js';

export const stepCount = style => STYLES[normalizeStyle(style)].stepCount;
export const freshPortrait = (style = 'simple') => ({ version: 2, style: normalizeStyle(style), phase: 'shape', shape: null, results: [], value: null });
export const portraitKey = studentId => `drawing-portrait:v1:${studentId ?? 'local'}`;

const die = value => Number.isInteger(value) && value >= 1 && value <= 6;
export function validPortrait(raw) {
  if (raw?.version !== 2 || !STYLES[raw.style] || !['shape', 'part', 'done'].includes(raw.phase)) return false;
  const steps = stepCount(raw.style);
  if (!Array.isArray(raw.results) || !raw.results.every(die) || raw.results.length > steps) return false;
  if (raw.value !== null && !die(raw.value)) return false;
  if (raw.phase === 'shape') return raw.results.length === 0 && raw.value === null;
  if (!Number.isInteger(raw.shape) || !STYLES[raw.style].faces[raw.shape]) return false;
  return raw.phase === 'done' ? raw.results.length === steps && raw.value === null : raw.results.length < steps;
}
// The adult's style setting wins: a portrait saved in another style starts over.
// Version 1 (before styles, 2026-11-15) was always the Picasso style.
export function readPortrait(key, style = 'simple') {
  const wanted = normalizeStyle(style);
  try {
    let raw = JSON.parse(localStorage.getItem(key));
    if (raw?.version === 1) raw = { ...raw, version: 2, style: 'picasso' };
    return validPortrait(raw) && raw.style === wanted ? raw : freshPortrait(wanted);
  } catch { return freshPortrait(wanted); }
}
export function savePortrait(key, state) {
  try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* Works without storage, just no resume. */ }
}

export const chooseShape = (state, shape) => STYLES[state.style].faces[shape] ? { ...state, phase: 'part', shape, results: [], value: null } : state;
export const pick = (state, value) => state.phase === 'part' && die(value) ? { ...state, value } : state;
export function next(state) {
  if (state.phase !== 'part' || state.value === null) return state;
  const results = [...state.results, state.value];
  return { ...state, results, value: null, phase: results.length === stepCount(state.style) ? 'done' : 'part' };
}
// One step back: an unchosen part returns to the previous part with its value still chosen.
export function back(state) {
  if (state.phase === 'done') return { ...state, phase: 'part', results: state.results.slice(0, -1), value: state.results.at(-1) };
  if (state.phase !== 'part') return state;
  if (state.value !== null) return { ...state, value: null };
  if (!state.results.length) return freshPortrait(state.style);
  return { ...state, results: state.results.slice(0, -1), value: state.results.at(-1) };
}
