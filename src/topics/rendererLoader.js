import { getDb, topics } from "@/core/db";

const _cache = new Map();

async function readFile(db, topicId, ...names) {
  for (const name of names) {
    const blob = await topics.getFile(db, topicId, name);
    if (blob) return blob;
  }
  return null;
}

function injectCss(css, topicId) {
  const id = `mirocard-renderer-css-${topicId}`;
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

export async function loadRenderer(topicId) {
  if (_cache.has(topicId)) return _cache.get(topicId);

  const db = await getDb();

  // Vite IIFE lib build outputs without extension when fileName is a function
  const jsBlob = await readFile(db, topicId, "renderer", "renderer.js", "renderer.iife.js");
  if (!jsBlob) return null;

  // Inject CSS if present (Vite extracts it separately for IIFE format)
  const cssBlob = await readFile(db, topicId, "mirocard2.css", "renderer.css");
  if (cssBlob) injectCss(await cssBlob.text(), topicId);

  const code = await jsBlob.text();

  // Indirect eval executes in global scope: var __MirocardRenderer = … → window.__MirocardRenderer
  // window.__Mirocard must be set before this (done in main.jsx).
  // eslint-disable-next-line no-eval
  (0, eval)(code);

  const Component = window.__MirocardRenderer?.default ?? window.__MirocardRenderer ?? null;
  delete window.__MirocardRenderer;

  if (Component) _cache.set(topicId, Component);
  return Component;
}

export function clearRendererCache(topicId) {
  if (topicId) _cache.delete(topicId);
  else _cache.clear();
}
