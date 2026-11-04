/**
 * Plain-text authoring format for the short-stories text locator.
 *
 *   # Мяч по очереди
 *   ? Найди, сколько мячей было у Вани и Миши.
 *   + один мяч
 *   * Как ты думаешь, почему мама попросила катать мяч по очереди?
 *
 * `?` is the prompt, `+` the exact word or phrase the child finds and taps.
 * Additional `+` lines under the same prompt specify accepted alternatives
 * in the story — the minimum is authored per story (five by default). `*` is an
 * optional, unscored discussion question with no located phrase: a "why" or
 * "what would you do" prompt meant for the child to answer out loud to the
 * adult, not by tapping the text. Keeping the source as plain text makes a
 * per-child correction far less cumbersome than a form.
 */
export function getMinimumStoryFindQuestions(story) {
  return Number.isInteger(story?.minimumFindQuestions) && story.minimumFindQuestions > 0
    ? story.minimumFindQuestions
    : 5;
}

// Shared by the task engine and settings validation. An unconfigured legacy
// deck still means all stories; the revised deck starts with micro-stories.
export function getSelectedReadingStories(topicRecord, sessionParams = {}) {
  const stage = sessionParams?.storyStage ?? topicRecord?.meta?.defaultStoryStage;
  const stories = (topicRecord?.texts ?? []).filter((story) => story.kind === "story"
    && (!stage || story.storyStage === stage));
  const selectedIds = stage === "micro"
    ? sessionParams?.selectedMicroStories
    : sessionParams?.selectedStories;
  return selectedIds?.length ? stories.filter((story) => selectedIds.includes(story.id)) : stories;
}

// Keep a child's edited blocks while adding new stories from deck updates.
// Invalid edits stay visible to validation instead of silently falling back.
export function mergeStoryQuizText(defaultText, customText, previousDefaultTexts = []) {
  if (!customText?.trim()) return defaultText ?? "";
  const base = parseStoryQuizText(defaultText);
  const custom = parseStoryQuizText(customText);
  if (!base.valid || !custom.valid) return customText;
  const overrides = new Map(custom.groups.map((group) => [group.title, group]));
  // A saved editor value contains the full collection. Refresh blocks that
  // still equal a published default; retain actual per-child edits, including
  // invalid ones, so validation can explain what needs the adult's attention.
  const signature = (group) => JSON.stringify(group.questions.map(({ kind, prompt, target, targets }) => [kind, prompt, targets ?? (target ? [target] : null)]));
  const obsoleteDefaults = new Set();
  for (const previousText of Array.isArray(previousDefaultTexts) ? previousDefaultTexts : []) {
    const previous = parseStoryQuizText(previousText);
    if (!previous.valid) continue;
    for (const group of previous.groups) {
      const override = overrides.get(group.title);
      if (override && signature(override) === signature(group)) {
        overrides.delete(group.title);
        obsoleteDefaults.add(group.title);
      }
    }
  }
  const baseTitles = new Set(base.groups.map((group) => group.title));
  const groups = [
    ...base.groups.map((group) => overrides.get(group.title) ?? group),
    ...custom.groups.filter((group) => !baseTitles.has(group.title) && !obsoleteDefaults.has(group.title)),
  ];
  return groups.map((group) => `# ${group.title}\n\n${group.questions.map((question) => (
    question.kind === "discuss" ? `* ${question.prompt}` : `? ${question.prompt}\n${(question.targets ?? [question.target]).map((target) => `+ ${target}`).join("\n")}`
  )).join("\n\n")}`).join("\n\n");
}

export function normalizeStoryQuizText(value) {
  return String(value ?? "")
    .toLocaleLowerCase("ru-RU")
    // The syllable-reading variant inserts hyphens inside a word. They do
    // not change what the child should be able to find.
    .replace(/(\p{L})-(?=\p{L})/gu, "$1")
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

/**
 * Splits one rendered line into its individual words, each with the
 * character range it occupies in the visible text. Shared by the target
 * matcher below and by the renderer, which makes every word — not just the
 * target phrase — its own tap target.
 */
export function tokenizeStoryQuizWords(lineText) {
  const text = String(lineText ?? "");
  return [...text.matchAll(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    normalized: normalizeStoryQuizText(match[0])[0] ?? "",
  }));
}

/**
 * Finds all whole-word occurrences of a target phrase in one rendered line.
 * The returned character ranges refer to visible text, including the
 * syllable-reading variant, so the renderer can make them accessible targets.
 */
export function getStoryQuizTargetMatches(lineText, target) {
  if (Array.isArray(target)) {
    // Keep accepted alternatives as separate candidates where possible.
    // For nested phrases the shorter accepted answer remains tappable.
    const candidates = target.flatMap((value) => getStoryQuizTargetMatches(lineText, value))
      .sort((a, b) => (a.end - a.start) - (b.end - b.start) || a.start - b.start);
    const chosen = [];
    for (const candidate of candidates) {
      if (!chosen.some((range) => candidate.start < range.end && range.start < candidate.end)) chosen.push(candidate);
    }
    return chosen.sort((a, b) => a.start - b.start);
  }
  const wanted = normalizeStoryQuizText(target);
  if (!wanted.length) return [];

  const text = String(lineText ?? "");
  const words = tokenizeStoryQuizWords(text);
  const matches = [];

  for (let index = 0; index <= words.length - wanted.length; index += 1) {
    const fits = wanted.every((word, offset) => words[index + offset].normalized === word);
    if (fits) {
      matches.push({ start: words[index].start, end: words[index + wanted.length - 1].end });
      index += wanted.length - 1;
    }
  }
  return matches;
}

export function storyQuizTargetExists(story, target) {
  return (story?.lines ?? []).some((line) => getStoryQuizTargetMatches(line?.text ?? line, target).length > 0);
}

export function parseStoryQuizText(source) {
  const lines = String(source ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const errors = [];
  const groups = [];
  const seenTitles = new Set();
  let group = null;
  let question = null;
  let questionNumber = 0;

  function fail(line, message) {
    errors.push({ line, message });
  }

  function finishQuestion() {
    if (!question) return;
    if (!question.target) {
      fail(question.line, "После вопроса укажите фрагмент для поиска со знаком +.");
    }
    if (!group) {
      fail(question.line, "Вопрос нужно поместить после названия рассказа со знаком #.");
    } else {
      group.questions.push({
        id: `q${group.questions.length + 1}`,
        kind: "find",
        prompt: question.prompt,
        target: question.target,
        ...(question.targets.length > 1 ? { targets: question.targets } : {}),
        targetLine: question.targetLine,
      });
    }
    question = null;
  }

  function finishGroup() {
    finishQuestion();
    if (group) groups.push(group);
    group = null;
  }

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line) return;

    if (line.startsWith("#")) {
      finishGroup();
      const title = line.slice(1).trim();
      if (!title) {
        fail(lineNumber, "После # укажите название рассказа.");
        return;
      }
      if (seenTitles.has(title)) {
        fail(lineNumber, `Рассказ «${title}» указан дважды.`);
        return;
      }
      seenTitles.add(title);
      group = { title, questions: [] };
      return;
    }

    if (line.startsWith("?")) {
      finishQuestion();
      const prompt = line.slice(1).trim();
      if (!prompt) {
        fail(lineNumber, "После ? напишите вопрос.");
        return;
      }
      questionNumber += 1;
      question = { line: lineNumber, prompt, target: "", targets: [], targetLine: null };
      return;
    }

    if (line.startsWith("+")) {
      if (!question) {
        fail(lineNumber, "Фрагмент для поиска должен идти после вопроса со знаком ?.");
        return;
      }
      const target = line.slice(1).trim();
      if (!target) {
        fail(lineNumber, "После знака + напишите слово или фразу из рассказа.");
        return;
      }
      if (!question.target) {
        question.target = target;
        question.targetLine = lineNumber;
      }
      if (!question.targets.includes(target)) question.targets.push(target);
      return;
    }

    if (line.startsWith("-")) {
      fail(lineNumber, "В этом режиме дистракторы не нужны: оставьте вопрос ? и фрагмент +.");
      return;
    }

    if (line.startsWith("*")) {
      finishQuestion();
      const prompt = line.slice(1).trim();
      if (!prompt) {
        fail(lineNumber, "После * напишите вопрос для обсуждения.");
        return;
      }
      if (!group) {
        fail(lineNumber, "Вопрос для обсуждения нужно поместить после названия рассказа со знаком #.");
        return;
      }
      // A discussion question has no located phrase, so it needs no + line
      // and does not count toward finishQuestion's error checks — push it
      // straight in.
      group.questions.push({ id: `q${group.questions.length + 1}`, kind: "discuss", prompt });
      questionNumber += 1;
      return;
    }

    fail(lineNumber, "Используйте # для рассказа, ? для вопроса, + для фрагмента в тексте и * для вопроса на обсуждение.");
  });

  finishGroup();
  if (!questionNumber) fail(1, "Добавьте хотя бы один вопрос.");

  return { groups, errors, valid: errors.length === 0 };
}

/**
 * Validates both the text-file structure and the fact that every marked
 * fragment can be found in the selected story itself.
 */
export function validateStoryQuizText(source, stories, selectedStoryIds = []) {
  const parsed = parseStoryQuizText(source);
  const errors = [...parsed.errors];
  const storyByTitle = new Map((stories ?? []).map((story) => [story.title, story]));
  const selected = selectedStoryIds?.length
    ? (stories ?? []).filter((story) => selectedStoryIds.includes(story.id))
    : (stories ?? []);

  for (const group of parsed.groups) {
    const story = storyByTitle.get(group.title);
    if (!story) {
      errors.push({ line: null, message: `Рассказ «${group.title}» не найден в этой теме.` });
      continue;
    }
    for (const question of group.questions) {
      if (question.kind === "discuss") continue;
      for (const target of question.targets ?? [question.target]) {
        if (target && !storyQuizTargetExists(story, target)) {
          errors.push({
            line: question.targetLine,
            message: `Фрагмент «${target}» не найден в рассказе «${group.title}».`,
          });
        }
      }
    }
  }

  for (const story of selected) {
    const group = parsed.groups.find((candidate) => candidate.title === story.title);
    if (!group) {
      errors.push({ line: null, message: `Нет вопросов к рассказу «${story.title}».` });
      continue;
    }
    // An oral question cannot substitute for a required text-search question.
    const findCount = group.questions.filter((question) => question.kind !== "discuss").length;
    const minimum = getMinimumStoryFindQuestions(story);
    if (findCount < minimum) {
      errors.push({ line: null, message: `К рассказу «${story.title}» нужно не меньше ${minimum} вопросов со знаком + (сейчас ${findCount}).` });
    }
    if (story.character && normalizeStoryQuizText(group.questions[0]?.target).join(" ") !== normalizeStoryQuizText(story.character).join(" ")) {
      errors.push({ line: null, message: `Первым в рассказе «${story.title}» должен быть вопрос об имени: ${story.character}.` });
    }
  }

  return { ...parsed, errors, valid: errors.length === 0 };
}

export function quizGroupsByStoryId(parsed, stories) {
  const storyIdByTitle = new Map((stories ?? []).map((story) => [story.title, story.id]));
  return Object.fromEntries(
    parsed.groups
      .filter((group) => storyIdByTitle.has(group.title))
      .map((group) => [storyIdByTitle.get(group.title), group.questions]),
  );
}
