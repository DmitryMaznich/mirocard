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

// "# options:" declares choice groups (e.g. a topping) — each indented line
// is "groupId | product | qty | unit". Used by the cook-start screen to
// render a picker and by the reading engine to fill in {groupId} in step
// text (see parseRecipeTxt.js's applyOptionSelections/filterStepsByOptions).
function parseOptions(txt) {
  const options = {};
  let inOptions = false;
  for (const rawLine of txt.split('\n')) {
    if (!rawLine.startsWith('#')) { inOptions = false; continue; }
    const afterHash = rawLine.slice(1);
    if (inOptions) {
      if (afterHash.startsWith('  ') || afterHash.startsWith('\t\t')) {
        const parts = afterHash.trim().split('|').map((p) => p.trim());
        const [groupId, product] = parts;
        if (groupId && product) {
          if (!options[groupId]) options[groupId] = [];
          options[groupId].push({
            product,
            qty: parts[2] ? parseFloat(parts[2]) || null : null,
            unit: parts[3] || null,
          });
        }
        continue;
      }
      inOptions = false;
    }
    if (afterHash.trim() === 'options:') inOptions = true;
  }
  return options;
}

// "# adjustable:" declares which {key:...} template placeholders in the step
// text get an editable stepper on the cook-start screen: which section it
// belongs to, what to label it, and what compact unit abbreviation to show
// next to the number. Each indented line is "key | group | label | unit" —
// group is "ingredient" or "time" (used to sort the key into one of the two
// ledger sections on the start-cooking screen). A key only gets a stepper if
// it's ALSO declared here AND appears in a {key:...} template somewhere in
// the steps (see extractAdjustableTemplates in parseRecipeTxt.js) — this
// block supplies the group/label/unit, the step text supplies the number.
export function parseAdjustable(txt) {
  const adjustable = {};
  let inAdjustable = false;
  for (const rawLine of txt.split('\n')) {
    if (!rawLine.startsWith('#')) { inAdjustable = false; continue; }
    const afterHash = rawLine.slice(1);
    if (inAdjustable) {
      if (afterHash.startsWith('  ') || afterHash.startsWith('\t\t')) {
        const parts = afterHash.trim().split('|').map((p) => p.trim());
        const [key, group, label, unit] = parts;
        if (key && group && label && unit) adjustable[key] = { group, label, unit };
        continue;
      }
      inAdjustable = false;
    }
    if (afterHash.trim() === 'adjustable:') inAdjustable = true;
  }
  return adjustable;
}

// "# option_groups:" declares per-group behavior for "# options:" groups:
// each indented line is "groupId | mode | label" — mode is "single" (exactly
// one choice always selected, e.g. swapping the one filling in an omelette)
// or "multi" (any subset or none, e.g. porridge toppings). A group with no
// entry here defaults to multi + the generic "Топпинг" label, so existing
// recipes that only have "# options:" (no "# option_groups:") keep working
// unchanged.
export function parseOptionGroups(txt) {
  const groups = {};
  let inGroups = false;
  for (const rawLine of txt.split('\n')) {
    if (!rawLine.startsWith('#')) { inGroups = false; continue; }
    const afterHash = rawLine.slice(1);
    if (inGroups) {
      if (afterHash.startsWith('  ') || afterHash.startsWith('\t\t')) {
        const parts = afterHash.trim().split('|').map((p) => p.trim());
        const [groupId, mode, label] = parts;
        if (groupId && mode && label) groups[groupId] = { mode, label };
        continue;
      }
      inGroups = false;
    }
    if (afterHash.trim() === 'option_groups:') inGroups = true;
  }
  return groups;
}

function buildTextEntry(id, content) {
  const photo = parseHeaderField(content, 'photo:');
  const status = parseHeaderField(content, 'status:') === 'final' ? 'final' : 'draft';
  const type = parseHeaderField(content, 'type:');
  const portionsRaw = parseHeaderField(content, 'portions:');
  const portions = portionsRaw ? (parseInt(portionsRaw, 10) || 1) : 1;
  const fixedPortions = type === 'fixed' ? portions : null;
  const maxPortionsRaw = parseHeaderField(content, 'max_portions:');
  const maxPortions = maxPortionsRaw ? (parseInt(maxPortionsRaw, 10) || null) : null;
  const title = extractTitle(content);
  const options = parseOptions(content);
  const optionGroups = parseOptionGroups(content);
  const adjustable = parseAdjustable(content);

  return {
    id: `${id}_instruction`,
    kind: 'instruction',
    title: { ru: title, en: title },
    ...(photo ? { photo: `media/${photo}` } : {}),
    image: `media/${id}.svg`,
    portions,
    ...(fixedPortions ? { fixedPortions } : {}),
    ...(maxPortions ? { maxPortions } : {}),
    ...(Object.keys(options).length ? { options } : {}),
    ...(Object.keys(optionGroups).length ? { optionGroups } : {}),
    ...(Object.keys(adjustable).length ? { adjustable } : {}),
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
      requiresTimer: true,
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
