/**
 * Parse plain-text recipe format into step objects.
 *
 * Format rules:
 *   N. Step text     → {type: "action", text}
 *   - Item           → checklist item appended to previous step
 *   Plain line       → {type: "heading", text}
 */
export function parseRecipeTxt(raw) {
  const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const steps = [];
  let current = null;
  let stepNum = 0;
  let currentSubgroup = null;

  function flush() {
    if (current) {
      steps.push(current);
      current = null;
      currentSubgroup = null;
    }
  }

  for (const line of lines) {
    if (line.startsWith("#")) continue; // metadata comment, skip

    // Accept ASCII brackets [ ] or fullwidth ［ ］ (U+FF3B / U+FF3D)
    const imgMatch = line.match(/^[\[［]([^\]］]+\.\w+)[\]］]$/);
    if (imgMatch) {
      if (current) {
        current.image = imgMatch[1].trim();
      } else {
        flush();
        stepNum++;
        current = { id: `s${stepNum}`, type: "image", file: imgMatch[1].trim() };
      }
      continue;
    }

    const numMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      flush();
      stepNum++;
      const text = numMatch[2];
      current = {
        id: `s${stepNum}`,
        type: text.trim() === "Проверка!" ? "warning" : "action",
        text,
      };
      continue;
    }

    if (line.startsWith("> ") && current && (current.type === "action" || current.type === "heading")) {
      current.text += "\n" + line.slice(2).trim();
      continue;
    }

    if (line.startsWith("* ") && current && (current.type === "action" || current.type === "checklist")) {
      if (current.type === "action") {
        current.type = "checklist";
        current.items = [];
      }
      currentSubgroup = line.slice(2).trim() || null;
      continue;
    }

    if (line.startsWith("- ") && current && (current.type === "action" || current.type === "checklist")) {
      if (current.type === "action") {
        current.type = "checklist";
        current.items = [];
      }
      current.items.push(line.slice(2).trim());
      if (currentSubgroup !== null) {
        if (!current.itemSubgroups) current.itemSubgroups = new Array(current.items.length - 1).fill(null);
        current.itemSubgroups.push(currentSubgroup);
      } else if (current.itemSubgroups) {
        current.itemSubgroups.push(null);
      }
      continue;
    }

    // Plain line = heading / title
    flush();
    current = {
      id: `h${steps.length + 1}`,
      type: "heading",
      text: line,
    };
  }

  flush();

  // Post-process: any heading whose text looks like [file.ext] becomes step.image on previous step
  const imgTagRe = /^[\[［]([^\]］]+\.\w+)[\]］]$/;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].type !== "heading") continue;
    const m = steps[i].text.match(imgTagRe);
    if (!m) continue;
    if (i > 0) steps[i - 1].image = m[1].trim();
    steps.splice(i, 1);
  }

  return steps;
}

/**
 * Serialize step objects back to plain text (for the recipe editor textarea).
 * Only needed when generating initial text from legacy JSON steps.
 */
export function serializeRecipeTxt(steps) {
  const lines = [];
  let num = 0;

  for (const step of steps) {
    if (step.type === "heading") {
      lines.push(step.text);
    } else {
      num++;
      lines.push(`${num}. ${step.text}`);
      const subs = step.itemSubgroups;
      let prevSub = undefined;
      for (let i = 0; i < (step.items ?? []).length; i++) {
        const sub = subs?.[i] ?? null;
        if (sub !== null && sub !== prevSub) lines.push(`* ${sub}`);
        lines.push(`- ${step.items[i]}`);
        prevSub = sub;
      }
    }
  }

  return lines.join("\n");
}

const FIRE_LEVELS = [
  { re: /очень сильный огонь/gi, emoji: "🔥🔥🔥🔥", key: "veryStrong" },
  { re: /сильный огонь/gi,       emoji: "🔥🔥🔥",   key: "strong" },
  { re: /средний огонь/gi,       emoji: "🔥🔥",     key: "medium" },
  { re: /слабый огонь/gi,        emoji: "🔥",       key: "weak" },
];

/**
 * "очень сильный огонь" etc. become fire emoji — every stove's dial numbers
 * differ, so when the family has configured their own mapping (see
 * getStoveHeatMapping/saveStoveHeatMapping in groupStore.js) the matching
 * dial number is appended next to the emoji, e.g. "🔥🔥🔥 · 7". Without a
 * configured mapping this falls back to plain emoji, unchanged.
 */
export function applyFireEmoji(text, stoveHeatMapping) {
  if (!text) return text ?? "";
  let result = text;
  for (const { re, emoji, key } of FIRE_LEVELS) {
    const num = stoveHeatMapping?.[key];
    result = result.replace(re, num ? `${emoji} · ${num}` : emoji);
  }
  return result;
}

function pluralizeRu(n, one, few, many) {
  const mod100 = Math.abs(Math.round(n)) % 100;
  const mod10  = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1)  return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/**
 * Scale ingredient quantities in text marked with {N} or {N|one|few|many} syntax.
 * {2} with portions=3 → "6"
 * {2|стакан|стакана|стаканов} with portions=3 → "6 стаканов"
 */
// "половина/половину/с половиной X" needs the genitive singular form of the
// whole measuring phrase. The noun half of `few` (used for 2-4, e.g.
// "ложки") is already genitive singular — only its agreeing adjective is
// wrong, since `few` carries the plural adjective form ("чайные"). Русское
// правило: множественное "-ые"/"-ие" → родительный падеж ед.ч. "-ой"/"-ей".
function toGenitiveSingular(few) {
  return few.replace(/(\S*)ые(\s|$)/, "$1ой$2").replace(/(\S*)ие(\s|$)/, "$1ей$2");
}

export function formatWithUnit(val, one, few, many) {
  // Snap to nearest 0.5 to avoid floating-point drift (e.g. 0.5*7 = 3.5000000000000004)
  const snapped = Math.round(val * 2) / 2;
  const whole   = Math.floor(snapped);
  const isHalf  = snapped - whole === 0.5;

  if (isHalf) {
    const prefix = whole > 0 ? `${whole} с половиной` : "половину";
    return `${prefix} ${toGenitiveSingular(few.trim())}`;
  }
  return `${whole} ${pluralizeRu(whole, one.trim(), few.trim(), many.trim())}`;
}

/**
 * Settings-screen readout: compact numeral + abbreviated unit ("4½ ст.л.").
 * Deliberately NOT the grammatically-declined phrase formatWithUnit produces
 * ("4 с половиной столовой ложки") — that phrasing is for a child to read
 * aloud during cooking; this is a config control for the adult setting up
 * the session, where a compact value scans faster across many rows.
 */
export function formatCompact(val, unit) {
  const snapped = Math.round(val * 2) / 2;
  const whole = Math.floor(snapped);
  const isHalf = snapped - whole === 0.5;
  const num = isHalf ? (whole > 0 ? `${whole}½` : '½') : `${whole}`;
  return `${num} ${unit}`;
}

/**
 * Multiplier to pass into applyPortions() for a recipe's step text.
 *
 * Regular recipes scale with whatever portion count the user picked
 * relative to the recipe's own base amount. A fixed_portions recipe is
 * cooked as one inherent batch — its base amounts already are the
 * full-batch amount, so the ratio is always 1, exactly like the shopping
 * list's scale (fixedPortions / portions).
 */
export function stepPortionsMultiplier(basePortions, fixedPortions, chosenPortions) {
  const base = basePortions || 1;
  const chosen = fixedPortions ?? chosenPortions ?? base;
  return chosen / base;
}

/**
 * {base+step|one|few|many} — additive scaling, for quantities that don't
 * simply multiply with the batch size (e.g. stovetop heating time: doubling
 * the liquid does NOT double the time a fixed-power burner needs — cooking
 * guidance puts it at roughly +15-25% per doubling, not +100%, since burner
 * power stays constant and a larger volume loses proportionally less heat
 * to its surroundings). Renders as `base + step * (factor - 1)`, so at
 * factor=1 (the recipe's own base portions) it's exactly `base`, and each
 * additional batch-multiple adds a flat `step` instead of re-multiplying
 * the whole value. Use the ordinary {N|...} template for anything that
 * actually does scale proportionally (ingredient quantities, etc).
 */
function applyAdditiveScaling(text, factor, overrides) {
  return text.replace(
    /\{(?:([a-zA-Z]\w*):)?(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)\|([^|}]+)\|([^|}]+)\|([^|}]+)\}/g,
    (_, key, base, step, one, few, many) => {
      const value = key && overrides[key] != null
        ? overrides[key]
        : parseFloat(base) + parseFloat(step) * (factor - 1);
      return formatWithUnit(value, one, few, many);
    }
  );
}

/**
 * {key:/N|one|few|many} — coverage scaling, for a whole discrete unit that
 * comfortably serves up to N portions before a second one is needed (e.g.
 * one tomato thinly sliced covers up to 5 burgers — a 7-portion batch still
 * only needs 2 tomatoes, not 7*0.2=1.4). Renders as `ceil(factor / N)`, a
 * step function rather than a smooth ratio — {base+step|...} can't express
 * this because no linear formula stays flat across a whole coverage range
 * and then jumps a full unit at the boundary. Use this for "one X covers a
 * batch of Y" ingredients; use {N|...} for anything that scales smoothly
 * with the batch size.
 */
function applyCoverageScaling(text, factor, overrides) {
  return text.replace(
    /\{([a-zA-Z]\w*):\/(\d+)\|([^|}]+)\|([^|}]+)\|([^|}]+)\}/g,
    (_, key, divisor, one, few, many) => {
      const value = overrides[key] != null ? overrides[key] : Math.ceil(factor / parseFloat(divisor));
      return formatWithUnit(value, one, few, many);
    }
  );
}

/**
 * {N?singular_phrase|plural_phrase} — chooses between two differently-shaped
 * phrasings depending on whether the portion-scaled quantity resolves to
 * exactly one or to more than one, without printing the number itself
 * (unlike {N|one|few|many}). Needed when pluralizing a noun isn't enough and
 * the whole sentence shape changes with the count — e.g. "разлить в кружку"
 * (one mug) vs "разлить по кружкам" (several mugs): the preposition itself
 * changes (в → по), not just the noun's case/number.
 */
function applyConditionalPhrase(text, factor) {
  return text.replace(
    /\{(\d+(?:\.\d+)?)\?([^|}]+)\|([^|}]+)\}/g,
    (_, n, singular, plural) => (Math.round(parseFloat(n) * factor) === 1 ? singular.trim() : plural.trim())
  );
}

/**
 * {key:/N?singular_phrase|plural_phrase} — the coverage-scaling counterpart
 * of {N?singular|plural}: chooses a phrasing without printing the number,
 * based on the SAME ceil(factor / N) a {key:/N|...} occurrence of this key
 * elsewhere in the recipe already shows the child (e.g. step 3 already said
 * "взять 2 помидора" — a later prep step doesn't need to repeat the count,
 * just "Помыть помидоры" vs "Помыть помидор"). {N?...} can't be reused here
 * because its formula is a plain N*factor ratio, not a ceiling division —
 * at, say, 3 portions it would wrongly conclude "plural" even though the
 * coverage count is still exactly 1.
 */
function applyCoverageConditional(text, factor, overrides) {
  return text.replace(
    /\{([a-zA-Z]\w*):\/(\d+)\?([^|}]+)\|([^|}]+)\}/g,
    (_, key, divisor, singular, plural) => {
      const value = overrides[key] != null ? overrides[key] : Math.ceil(factor / parseFloat(divisor));
      return value === 1 ? singular.trim() : plural.trim();
    }
  );
}

/**
 * {key:base+step?singular_phrase|plural_phrase} — the additive-scaling
 * counterpart of {N?singular|plural} / {key:/N?singular|plural}: chooses a
 * phrasing without printing the number, using the SAME base + step*(factor-1)
 * a {key:base+step|...} occurrence of this key elsewhere already shows the
 * child (e.g. step 3 already said "взять 4 солёных огурца" — the slicing
 * step just needs "Нарезать огурцы", not the count repeated). Rounds to the
 * nearest whole unit before the singular/plural check, same as {N?...} —
 * the exact half-unit value isn't shown here anyway, only a coarse "one vs
 * more than one" phrasing choice.
 */
function applyAdditiveConditional(text, factor, overrides) {
  return text.replace(
    /\{([a-zA-Z]\w*):(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)\?([^|}]+)\|([^|}]+)\}/g,
    (_, key, base, step, singular, plural) => {
      const value = overrides[key] != null
        ? overrides[key]
        : parseFloat(base) + parseFloat(step) * (factor - 1);
      return Math.round(value) === 1 ? singular.trim() : plural.trim();
    }
  );
}

export function applyPortions(text, portions, overrides = {}) {
  if (!text) return text ?? "";
  const factor = portions || 1;
  let result = applyConditionalPhrase(text, factor);
  result = applyAdditiveScaling(result, factor, overrides);
  result = applyCoverageScaling(result, factor, overrides);
  result = applyCoverageConditional(result, factor, overrides);
  result = applyAdditiveConditional(result, factor, overrides);
  result = result.replace(
    /\{(?:([a-zA-Z]\w*):)?(\d+(?:\.\d+)?)\|([^|}]+)\|([^|}]+)\|([^|}]+)\}/g,
    (_, key, n, one, few, many) => {
      const value = key && overrides[key] != null ? overrides[key] : parseFloat(n) * factor;
      return formatWithUnit(value, one, few, many);
    }
  );
  result = result.replace(/\{(\d+(?:\.\d+)?)\}/g, (_, n) => {
    const snapped = Math.round(parseFloat(n) * factor * 2) / 2;
    const whole   = Math.floor(snapped);
    if (snapped - whole === 0.5)
      return whole > 0 ? `${whole} с половиной` : "половина";
    return Number.isInteger(snapped) ? String(snapped) : String(parseFloat(snapped.toFixed(2)));
  });
  return result;
}

const ADDITIVE_TEMPLATE_RE = /\{([a-zA-Z]\w*):(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)\|([^|}]+)\|([^|}]+)\|([^|}]+)\}/g;
const PROPORTIONAL_KEYED_TEMPLATE_RE = /\{([a-zA-Z]\w*):(\d+(?:\.\d+)?)\|([^|}]+)\|([^|}]+)\|([^|}]+)\}/g;
const COVERAGE_TEMPLATE_RE = /\{([a-zA-Z]\w*):\/(\d+)\|([^|}]+)\|([^|}]+)\|([^|}]+)\}/g;

/**
 * Finds every {key:...} template in a recipe's raw text — the ones a cook
 * can override with a stepper on the start-cooking screen (see
 * RecipeStartParams in ParamsScreen.jsx). Keys with no {key:...} anywhere
 * in the text are not returned even if declared in # adjustable: — no
 * template to override means no stepper. First occurrence of a repeated
 * key wins.
 */
export function extractAdjustableTemplates(rawText) {
  const found = new Map();
  let match;
  ADDITIVE_TEMPLATE_RE.lastIndex = 0;
  while ((match = ADDITIVE_TEMPLATE_RE.exec(rawText)) !== null) {
    const [, key, base, step, one, few, many] = match;
    if (!found.has(key)) {
      found.set(key, { key, kind: "additive", base: parseFloat(base), step: parseFloat(step), one, few, many });
    }
  }
  PROPORTIONAL_KEYED_TEMPLATE_RE.lastIndex = 0;
  while ((match = PROPORTIONAL_KEYED_TEMPLATE_RE.exec(rawText)) !== null) {
    const [, key, base, one, few, many] = match;
    if (!found.has(key)) {
      found.set(key, { key, kind: "proportional", base: parseFloat(base), one, few, many });
    }
  }
  COVERAGE_TEMPLATE_RE.lastIndex = 0;
  while ((match = COVERAGE_TEMPLATE_RE.exec(rawText)) !== null) {
    const [, key, divisor, one, few, many] = match;
    if (!found.has(key)) {
      found.set(key, { key, kind: "coverage", divisor: parseFloat(divisor), one, few, many });
    }
  }
  return [...found.values()];
}

/**
 * The value a {key:...} template resolves to at a given portions factor,
 * before any manual override — same formula applyPortions/applyAdditiveScaling
 * use internally, exposed so the start-cooking screen can pre-fill each
 * stepper with the number the step would otherwise show.
 */
export function computeAdjustableDefault(template, factor) {
  if (template.kind === "additive") return template.base + template.step * (factor - 1);
  if (template.kind === "coverage") return Math.ceil(factor / template.divisor);
  return template.base * factor;
}

/**
 * The active student "owns" every step — wrapped in an array to match the
 * shape step-owner avatar rendering expects.
 */
export function resolveStepOwners(student) {
  return student ? [{ id: student.id, name: student.name, photoDataUrl: student.photo ?? null }] : [];
}

const COLLECTIVE_PORTIONS_RU = {
  1: "одного",
  2: "двоих",
  3: "троих",
  4: "четверых",
  5: "пятерых",
  6: "шестерых",
  7: "семерых",
  8: "восьмерых",
};

/**
 * "Готовим на двоих" style phrase for the recipe title card, using Russian
 * collective numerals for 1-8 (the observed max_portions range) and a plain
 * "на N человек" fallback above that.
 */
export function formatPortionsPhrase(count) {
  const n = Math.round(count) || 1;
  const word = COLLECTIVE_PORTIONS_RU[n];
  return word ? `Готовим на ${word}` : `Готовим на ${n} человек`;
}

const TIMER_OVERRIDE_RE = /установить\s+таймер\s+на\s+(\d+(?:[.,]\d+)?)\s*(секунд\w*|минут\w*|час\w*)/i;
const TIMER_PAREN_RE = /\(\s*установить\s+таймер/i;
const DURATION_RE = /(\d+(?:[.,]\d+)?)\s*(секунд\w*|минут\w*|час\w*)/gi;

function durationToMinutes(rawValue, unit) {
  const n = parseFloat(String(rawValue).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (/^час/.test(unit)) return Math.max(1, Math.round(n * 60));
  if (/^секунд/.test(unit)) return Math.max(1, Math.ceil(n / 60));
  return Math.max(1, Math.round(n));
}

/**
 * Extract the intended timer duration (in whole minutes, dial-granularity)
 * from a recipe step's "(установить таймер)" marker, so the app can
 * pre-configure the timer instead of making the child read the step and
 * drag the dial themselves.
 *
 * "(установить таймер на N минут/час)" is an explicit override and wins.
 * Otherwise the last "N минут/секунд/час" mention before the marker is
 * used. Sub-minute waits (секунд) round up to 1 minute — the analog dial
 * has no finer resolution than a minute.
 */
export function parseTimerMinutesFromText(text) {
  if (!text || !/установить\s+таймер/i.test(text)) return null;

  const override = text.match(TIMER_OVERRIDE_RE);
  if (override) return durationToMinutes(override[1], override[2]);

  const parenIndex = text.search(TIMER_PAREN_RE);
  const before = parenIndex >= 0 ? text.slice(0, parenIndex) : text;

  let match;
  let last = null;
  DURATION_RE.lastIndex = 0;
  while ((match = DURATION_RE.exec(before)) !== null) {
    last = match;
  }
  return last ? durationToMinutes(last[1], last[2]) : null;
}

const TIMER_MARKER_PAREN_RE = /\(\s*установить\s+таймер[^)]*\)/i;
const TIMER_LABEL_MAX_LENGTH = 50;

/**
 * Build a short label for the currently-running timer from the recipe step
 * text that triggered it, e.g. "Обжаривать 4 минуты (установить таймер)."
 * → "Обжаривать 4 минуты." — used so a running timer can say what it's
 * timing instead of a generic "Таймер".
 */
export function buildTimerLabel(text) {
  if (!text) return null;
  const stripped = text
    .replace(TIMER_MARKER_PAREN_RE, "")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!stripped) return null;
  if (stripped.length <= TIMER_LABEL_MAX_LENGTH) return stripped;
  const truncated = stripped.slice(0, TIMER_LABEL_MAX_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");
  const cut = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  return `${cut}…`;
}

/**
 * Group a recipe's parsed steps into phase segments for the progress bar.
 * A new segment starts at every `heading` step; steps before the first
 * heading (if any) form a leading untitled segment. Consecutive headings
 * each start their own segment.
 */
export function computeStepSegments(steps) {
  const segments = [];
  let current = null;
  steps.forEach((step, i) => {
    if (step.type === "heading" || !current) {
      if (current) segments.push(current);
      current = { title: step.type === "heading" ? step.text : null, startIndex: i, count: 0 };
    }
    current.count += 1;
  });
  if (current) segments.push(current);
  return segments;
}

// Matches a bare "{groupId}" option placeholder — deliberately excludes a
// leading digit so it can never collide with the {N}/{N|one|few|many}
// portion-scaling syntax (applyPortions), which always starts with a number.
const OPTION_PLACEHOLDER_RE = /\{([a-zA-Zа-яёА-ЯЁ]\w*)\}/g;

function joinOptionChoices(choices) {
  if (!choices || choices.length === 0) return "";
  if (choices.length === 1) return choices[0];
  return `${choices.slice(0, -1).join(", ")} и ${choices[choices.length - 1]}`;
}

/**
 * Fills in "{groupId}" placeholders (e.g. "{topping}") with the
 * human-readable joined list of what the child picked for that option
 * group — see setSelectedOptions/getRecipeOptionSelections. A step whose
 * placeholder resolves to nothing should be dropped entirely first, via
 * filterStepsByOptions — this function assumes that already happened.
 */
export function applyOptionSelections(text, selections) {
  if (!text) return text ?? "";
  return text.replace(OPTION_PLACEHOLDER_RE, (_, groupId) => joinOptionChoices(selections?.[groupId]));
}

function isFulfilled(token, selections) {
  return (selections?.[token.slice(1, -1)]?.length ?? 0) > 0;
}

/**
 * Drops any step referencing an option group with nothing selected (e.g.
 * "Добавить в тарелку по вкусу: {topping}." when no topping was chosen) —
 * a bare, un-decorated "по вкусу: " line would make no sense to read.
 * Steps with no option placeholder at all pass through unaffected.
 *
 * Also filters individual checklist items the same way (e.g. step 3's
 * "взять {milk}" gathering line should vanish when milk wasn't chosen,
 * without dropping the rest of that checklist's items) — a step's own
 * `.text` is checked at the whole-step level above, but `.items` need
 * per-item filtering since one unfulfilled item shouldn't take its
 * unrelated siblings down with it. `.itemSubgroups`, when present, is
 * filtered in lockstep so it stays index-aligned with `.items`.
 */
export function filterStepsByOptions(steps, selections) {
  return steps
    .filter((step) => {
      const matches = step.text?.match(OPTION_PLACEHOLDER_RE);
      if (!matches) return true;
      return matches.every((token) => isFulfilled(token, selections));
    })
    .map((step) => {
      if (!step.items) return step;
      const keep = step.items.map((item) => {
        const matches = item.match(OPTION_PLACEHOLDER_RE);
        return !matches || matches.every((token) => isFulfilled(token, selections));
      });
      if (keep.every(Boolean)) return step;
      return {
        ...step,
        items: step.items.filter((_, i) => keep[i]),
        ...(step.itemSubgroups ? { itemSubgroups: step.itemSubgroups.filter((_, i) => keep[i]) } : {}),
      };
    });
}

/**
 * {groupId:product?matchPhrase|otherwisePhrase} — chooses a phrase based on
 * whether `product` is among the choices selected for `groupId`, instead of
 * substituting the raw chosen name via the bare {groupId} placeholder.
 * Needed when different choices genuinely need different instructions, not
 * just a different noun — e.g. an omelette's добавка is sliced into rounds
 * when it's sausage, but small pieces for chicken or other meat. Always
 * resolves to one of the two phrases (never "nothing to show"), so unlike
 * a bare {groupId} it never triggers filterStepsByOptions's step-dropping.
 */
export function applyOptionValueConditional(text, selections) {
  if (!text) return text ?? "";
  return text.replace(
    /\{([a-zA-Zа-яёА-ЯЁ]\w*):([^?|}]+)\?([^|}]+)\|([^|}]+)\}/g,
    (_, groupId, product, matchPhrase, otherwisePhrase) =>
      (selections?.[groupId] ?? []).includes(product.trim()) ? matchPhrase.trim() : otherwisePhrase.trim()
  );
}
