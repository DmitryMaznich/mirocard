// Synthesizes an in-memory "installed topic" record for the recipe library
// directly from content/recipes/*.txt, bundled at build time — no ZIP, no
// catalog entry, no install step. See docs/superpowers/specs/
// 2026-07-08-recipe-architecture-simplification-design.md.

const rawRecipeFiles = import.meta.glob('../../content/recipes/*.txt', {
  eager: true,
  query: '?raw',
  import: 'default',
});

export const RECIPES_TOPIC_ID = 'reading_dad_texts';
export const RECIPES_MEDIA_BASE_URL = '/recipe-media/';

function countSteps(txt) {
  return txt.split('\n').filter((l) => /^\d+\./.test(l)).length;
}

function extractTitle(txt) {
  for (const rawLine of txt.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('[')) continue;
    return line;
  }
  return '';
}

function parseHeaderField(txt, prefix) {
  for (const rawLine of txt.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('#')) continue;
    const kv = line.slice(1).trim();
    if (kv.startsWith(prefix)) return kv.slice(prefix.length).trim();
  }
  return null;
}

function buildTextEntry(id, content) {
  const photo = parseHeaderField(content, 'photo:');
  const status = parseHeaderField(content, 'status:') === 'final' ? 'final' : 'draft';
  const type = parseHeaderField(content, 'type:');
  const portionsRaw = parseHeaderField(content, 'portions:');
  const portions = portionsRaw ? (parseInt(portionsRaw, 10) || 1) : 1;
  const fixedPortions = type === 'fixed' ? portions : null;
  const title = extractTitle(content);

  return {
    id: `${id}_instruction`,
    kind: 'instruction',
    title: { ru: title, en: title },
    ...(photo ? { photo: `media/${photo}` } : {}),
    image: `media/${id}.svg`,
    portions,
    ...(fixedPortions ? { fixedPortions } : {}),
    status,
    file: `recipes/${id}.txt`,
    stepCount: countSteps(content),
  };
}

const rawTextByFile = new Map();
const textEntries = [];

for (const [globPath, content] of Object.entries(rawRecipeFiles)) {
  const id = globPath.split('/').pop().replace(/\.txt$/, '');
  const file = `recipes/${id}.txt`;
  rawTextByFile.set(file, content);
  textEntries.push(buildTextEntry(id, content));
}

textEntries.sort((a, b) => a.file.localeCompare(b.file));

export function buildRecipesTopicRecord() {
  return {
    meta: {
      id: RECIPES_TOPIC_ID,
      renderer: 'reading',
      version: '1.0.0',
      title: { ru: 'Готовим еду', en: 'Cooking' },
      builtin: true,
      hidden: true,
    },
    modes: [],
    cards: [],
    texts: textEntries,
    installedAt: 'builtin',
  };
}

export function getBuiltinRecipeRawText(filePath) {
  return rawTextByFile.get(filePath) ?? null;
}
