// ─── JSON → text ──────────────────────────────────────────────────────────────

export function scriptToText(script) {
  if (!script) return "";
  const { contact, turns = [] } = script;
  const contactName = contact?.name ?? "Контакт";
  const lines = [];

  if (contact) {
    lines.push(`Контакт: ${contactName}${contact.emoji ? " " + contact.emoji : ""}`);
    lines.push("");
  }

  for (const turn of turns) {
    lines.push(`${contactName}: ${turn.text}`);

    for (const choice of turn.choices ?? []) {
      if (turn.anyIsCorrect) {
        lines.push(`~ ${choice.text}`);
      } else if (choice.correct === true) {
        const reaction = choice.reactionOnCorrect ?? turn.reactionOnCorrect ?? null;
        lines.push(`+ ${choice.text}${reaction ? " > " + reaction : ""}`);
      } else {
        const reaction = choice.reactionOnWrong ?? null;
        lines.push(`- ${choice.text}${reaction ? " > " + reaction : ""}`);
      }
    }

    if (turn.anyIsCorrect && turn.reactionOnSend) {
      lines.push(`> ${turn.reactionOnSend}`);
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

// ─── text → JSON ──────────────────────────────────────────────────────────────

function splitReaction(str) {
  const idx = str.indexOf(" > ");
  if (idx === -1) return [str.trim(), null];
  return [str.slice(0, idx).trim(), str.slice(idx + 3).trim()];
}

export function textToScript(text, fallbackContact = null) {
  const lines = text.split("\n");
  let contact = fallbackContact ? { ...fallbackContact } : null;
  const turns = [];
  let current = null;
  let lastChoiceType = null;

  const pushCurrent = () => {
    if (current && current.choices.length > 0) turns.push(current);
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Контакт: Мама 👩
    if (line.startsWith("Контакт:")) {
      const rest = line.slice("Контакт:".length).trim();
      const emojiMatch = rest.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*$/u);
      if (emojiMatch) {
        contact = { name: rest.slice(0, emojiMatch.index).trim(), emoji: emojiMatch[0].trim() };
      } else {
        contact = { name: rest, emoji: null };
      }
      continue;
    }

    // Мама: текст (или любое «Имя: текст»)
    const contactLine = line.match(/^([^~+\->]+):\s+(.+)$/);
    if (contactLine) {
      pushCurrent();
      current = {
        id: `t${turns.length + 1}`,
        text: contactLine[2],
        anyIsCorrect: false,
        choices: [],
      };
      lastChoiceType = null;
      continue;
    }

    if (!current) continue;

    // ~ любой ответ
    if (line.startsWith("~ ")) {
      current.anyIsCorrect = true;
      current.choices.push({ text: line.slice(2).trim() });
      lastChoiceType = "tilde";
      continue;
    }

    // + правильный > реакция
    if (line.startsWith("+ ")) {
      const [choiceText, reaction] = splitReaction(line.slice(2));
      const choice = { text: choiceText, correct: true };
      if (reaction) choice.reactionOnCorrect = reaction;
      current.choices.push(choice);
      lastChoiceType = "plus";
      continue;
    }

    // - неправильный > реакция
    if (line.startsWith("- ")) {
      const [choiceText, reaction] = splitReaction(line.slice(2));
      const choice = { text: choiceText, correct: false };
      if (reaction) choice.reactionOnWrong = reaction;
      current.choices.push(choice);
      lastChoiceType = "minus";
      continue;
    }

    // > реакция (отдельная строка после блока ~)
    if (line.startsWith("> ") && lastChoiceType === "tilde") {
      current.reactionOnSend = line.slice(2).trim();
      continue;
    }
  }

  pushCurrent();
  return { contact, turns };
}
