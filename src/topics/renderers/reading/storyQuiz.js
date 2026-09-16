/**
 * Plain-text authoring format for the short-stories comprehension quiz.
 *
 *   # Мяч по очереди
 *   ? Сколько мячей было у Вани и Миши?
 *   + Один мяч
 *   - Два мяча
 *   - Три мяча
 *   - Ни одного мяча
 *
 * The format intentionally stays simple enough to edit in the parent
 * settings. `+` marks the single correct answer; the other three answers are
 * marked with `-`.
 */
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
    if (question.answers.length !== 4) {
      fail(question.line, `У вопроса должно быть 4 ответа, сейчас ${question.answers.length}.`);
    }
    const correctCount = question.answers.filter((answer) => answer.isCorrect).length;
    if (correctCount !== 1) {
      fail(question.line, "У вопроса должен быть один правильный ответ, отмеченный знаком +.");
    }
    if (!group) {
      fail(question.line, "Вопрос нужно поместить после названия рассказа со знаком #.");
    } else {
      group.questions.push({
        id: `q${group.questions.length + 1}`,
        prompt: question.prompt,
        answers: question.answers.map((answer, index) => ({
          id: `a${index + 1}`,
          text: answer.text,
          isCorrect: answer.isCorrect,
        })),
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
      question = { line: lineNumber, prompt, answers: [] };
      return;
    }

    if (line.startsWith("+") || line.startsWith("-")) {
      if (!question) {
        fail(lineNumber, "Ответ должен идти после вопроса со знаком ?.");
        return;
      }
      const text = line.slice(1).trim();
      if (!text) {
        fail(lineNumber, "После знака + или - напишите ответ.");
        return;
      }
      question.answers.push({ text, isCorrect: line.startsWith("+") });
      return;
    }

    fail(lineNumber, "Используйте # для рассказа, ? для вопроса, + для верного и - для неверного ответа.");
  });

  finishGroup();
  if (!questionNumber) fail(1, "Добавьте хотя бы один вопрос.");

  return { groups, errors, valid: errors.length === 0 };
}

/**
 * Validates that every selected story has enough questions. The editor uses
 * titles because they remain understandable in a regular .txt file; the
 * engine resolves those titles back to the story ids from the deck.
 */
export function validateStoryQuizText(source, stories, selectedStoryIds = []) {
  const parsed = parseStoryQuizText(source);
  const errors = [...parsed.errors];
  const storyByTitle = new Map((stories ?? []).map((story) => [story.title, story]));
  const selected = selectedStoryIds?.length
    ? (stories ?? []).filter((story) => selectedStoryIds.includes(story.id))
    : (stories ?? []);

  for (const group of parsed.groups) {
    if (!storyByTitle.has(group.title)) {
      errors.push({ line: null, message: `Рассказ «${group.title}» не найден в этой теме.` });
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
