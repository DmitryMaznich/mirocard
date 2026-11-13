// Lesson units, never pressure. Width and tolerance use the same input profile.
export const TRACK_WIDTHS = Object.freeze({ wide: 140, normal: 100, narrow: 60 });
export const PEN_WIDTHS = Object.freeze({ wide: 36, normal: 24, narrow: 16 });
export function trackProfile(width = 'normal', input = 'pen') {
  const touch = input === 'touch';
  width = Object.hasOwn(TRACK_WIDTHS, width) ? width : 'normal';
  return { width: (touch ? TRACK_WIDTHS : PEN_WIDTHS)[width] ?? (touch ? 100 : 24), extra: touch ? 15 : 4,
    resume: touch ? 60 : 20, finish: touch ? 60 : 20, close: touch ? 28 : 14,
    outsideMin: 12, outsideFast: 30, sampleStep: 3, corner: touch ? 42 : 16, ink: touch ? 14 : 6, noise: touch ? 18 : 7 };
}
export function resolveProfile(width = 'normal') {
  if (width && typeof width === 'object' && Number.isFinite(width.width)) return width;
  return { ...trackProfile(width, 'touch'), corner: 42 };
}
export function scaledProfile(profile, scale = 1) {
  return Object.fromEntries(Object.entries(resolveProfile(profile)).map(([key, value]) => [key, value / scale]));
}

// Fixed device profiles in CSS pixels; canonical coordinates are compensated by the placement scale.
export function screenProfile(input = 'pen') {
  const touch = input === 'touch';
  return { width: touch ? 56 : 10, extra: touch ? 7 : 3, resume: touch ? 32 : 14, finish: touch ? 32 : 14,
    close: touch ? 20 : 10, outsideMin: 6, outsideFast: 18, sampleStep: 2, corner: touch ? 26 : 10,
    ink: touch ? 7 : 3, noise: touch ? 10 : 4, markerRadius: touch ? 13 : 8, goalRadius: touch ? 21 : 14,
    markerHalo: 5, leadInk: touch ? 7 : 3, tipRadius: touch ? 9 : 5, markerStroke: 1.5, goalStroke: 3, markRadius: 16, leadLength: 24, overlayScale: 1 };
}
