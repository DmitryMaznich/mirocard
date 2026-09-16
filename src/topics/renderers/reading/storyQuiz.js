/**
 * Plain-text authoring format for the short-stories text locator.
 *
 *   # Мяч по очереди
 *   ? Найди, сколько мячей было у Вани и Миши.
 *   + один мяч
 *
 * `?` is the prompt. `+` is the exact word or phrase that the child needs
 * to find and tap in the story. Keeping the source as plain text makes a
 * per-child correction far less cumbersome than a form.
 */
export function normalizeStoryQuizText(value) {
  return String(value ?? "")
    .toLocaleLowerCase("ru-RU")
    // The syllable-reading variant inserts hyphens inside a word. They do
    // not change what the child should be able to find.
    .replace(/(\p{L})-(?=\p{L})/gu, "$1")
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

/**
 * Finds all whole-word occurrences of a target phrase in one rendered line.
 * The returned character ranges refer to visible text, including the
 * syllable-reading variant, so the renderer can make them accessible targets.
 */
export function getStoryQuizTargetMatches(lineText, target) {
  const wanted = normalizeStoryQuizText(target);
  if (!wanted.length) return [];

  const text = String(lineText ?? "");
  const words = [...text.matchAll(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu)]
    .map((match) => ({
      start: match.index,
      end: match.index + match[0].length,
      normalized: normalizeStoryQuizText(match[0])[0] ?? "",
    }));
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
        prompt: question.prompt,
        target: question.target,
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
      question = { line: lineNumber, prompt, target: "", targetLine: null };
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
      if (question.target) {
        fail(lineNumber, "У вопроса может быть только один фрагмент для поиска.");
        return;
      }
      question.target = target;
      question.targetLine = lineNumber;
      return;
    }

    if (line.startsWith("-")) {
      fail(lineNumber, "В этом режиме дистракторы не нужны: оставьте вопрос ? и фрагмент +.");
      return;
    }

    fail(lineNumber, "Используйте # для рассказа, ? для вопроса и + для фрагмента в тексте.");
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
      if (question.target && !storyQuizTargetExists(story, question.target)) {
        errors.push({
          line: question.targetLine,
          message: `Фрагмент «${question.target}» не найден в рассказе «${group.title}».`,
        });
      }
    }
  }

  for (const story of selected) {
    const group = parsed.groups.find((candidate) => candidate.title === story.title);
    if (!group) {
      errors.push({ line: null, message: `Нет вопросов к рассказу «${story.title}».` });
    } else if (group.questions.length < 5) {
      errors.push({ line: null, message: `К рассказу «${story.title}» нужно не меньше 5 вопросов.` });
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
