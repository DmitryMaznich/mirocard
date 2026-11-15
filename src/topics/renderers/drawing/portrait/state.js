// «Портрет по кубику»: the whole lesson state, kept on the device so a reload continues the portrait.
// Phases: shape → part (drawing steps) → done → color (optional colouring steps) → colored.
import { STYLES, normalizeStyle } from './styles.js';
import { colorSteps } from './paintPlan.js';

export const stepCount = style => STYLES[normalizeStyle(style)].stepCount;
export const freshPortrait = (style = 'simple') => ({ version: 2, style: normalizeStyle(style), phase: 'shape', shape: null, results: [], colors: [], value: null });
// v2 since «Простое лицо» got brows and a neck (2026-11-15): its steps moved, older saves start afresh.
export const portraitKey = studentId => `drawing-portrait:v2:${studentId ?? 'local'}`;
export const colorCount = state => colorSteps(state.style, state.shape, state.results).length;

const die = value => Number.isInteger(value) && value >= 1 && value <= 6;
export function validPortrait(raw) {
  if (raw?.version !== 2 || !STYLES[raw.style] || !['shape', 'part', 'done', 'color', 'colored'].includes(raw.phase)) return false;
  const steps = stepCount(raw.style), colors = raw.colors ?? [];
  if (!Array.isArray(raw.results) || !raw.results.every(die) || raw.results.length > steps) return false;
  if (!Array.isArray(colors) || !colors.every(die)) return false;
  if (raw.value !== null && !die(raw.value)) return false;
  if (raw.phase === 'shape') return raw.results.length === 0 && raw.value === null && !colors.length;
  if (!Number.isInteger(raw.shape) || !STYLES[raw.style].faces[raw.shape]) return false;
  if (raw.phase === 'part') return raw.results.length < steps && !colors.length;
  if (raw.results.length !== steps) return false;
  const total = colorCount(raw);
  if (raw.phase === 'done') return raw.value === null && !colors.length;
  if (raw.phase === 'color') return colors.length < total;
  return raw.value === null && colors.length === total;
}
// The adult's style setting wins: a portrait saved in another style starts over.
// Version 1 (before styles, 2026-11-15) was always the Picasso style.
export function readPortrait(key, style = 'simple') {
  const wanted = normalizeStyle(style);
  try {
    let raw = JSON.parse(localStorage.getItem(key));
    if (raw?.version === 1) raw = { ...raw, version: 2, style: 'picasso' };
    if (raw && !raw.colors) raw = { ...raw, colors: [] };
    return validPortrait(raw) && raw.style === wanted ? raw : freshPortrait(wanted);
  } catch { return freshPortrait(wanted); }
}
export function savePortrait(key, state) {
  try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* Works without storage, just no resume. */ }
}

export const chooseShape = (state, shape) => STYLES[state.style].faces[shape] ? { ...state, phase: 'part', shape, results: [], colors: [], value: null } : state;
export const pick = (state, value) => (state.phase === 'part' || state.phase === 'color') && die(value) ? { ...state, value } : state;
export const startColoring = state => state.phase === 'done' ? { ...state, phase: 'color', colors: [], value: null } : state;
export function next(state) {
  if (state.value === null) return state;
  if (state.phase === 'color') {
    const colors = [...state.colors, state.value];
    return { ...state, colors, value: null, phase: colors.length === colorCount(state) ? 'colored' : 'color' };
  }
  if (state.phase !== 'part') return state;
  const results = [...state.results, state.value];
  return { ...state, results, value: null, phase: results.length === stepCount(state.style) ? 'done' : 'part' };
}
// One step back: an unchosen step returns to the previous one with its value still chosen.
export function back(state) {
  if (state.phase === 'colored') return { ...state, phase: 'color', colors: state.colors.slice(0, -1), value: state.colors.at(-1) };
  if (state.phase === 'color') {
    if (state.value !== null) return { ...state, value: null };
    if (!state.colors.length) return { ...state, phase: 'done' };
    return { ...state, colors: state.colors.slice(0, -1), value: state.colors.at(-1) };
  }
  if (state.phase === 'done') return { ...state, phase: 'part', results: state.results.slice(0, -1), value: state.results.at(-1) };
  if (state.phase !== 'part') return state;
  if (state.value !== null) return { ...state, value: null };
  if (!state.results.length) return freshPortrait(state.style);
  return { ...state, results: state.results.slice(0, -1), value: state.results.at(-1) };
}
