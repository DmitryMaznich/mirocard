// The «Тетрадь в PDF» choices (PdfDialog.jsx), remembered on this device.
const OPTS_KEY = "print_letters:pdf-options";
const DEFAULT_OPTS = { cover: false, numbers: true, booklet: false };

export function loadOpts() {
  try { return { ...DEFAULT_OPTS, ...JSON.parse(window.localStorage.getItem(OPTS_KEY) || "{}") }; } catch { return DEFAULT_OPTS; }
}
export function saveOpts(o) {
  try { window.localStorage.setItem(OPTS_KEY, JSON.stringify(o)); } catch { /* private mode: not remembered */ }
}
