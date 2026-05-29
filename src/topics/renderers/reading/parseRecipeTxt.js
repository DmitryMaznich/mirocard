/**
 * Parse plain-text recipe format into step objects.
 *
 * Format rules:
 *   N. Step text     → {type: "action", text, owner}
 *   - Item           → checklist item appended to previous step
 *   @Name            → sets owner for all following steps
 *   Plain line       → {type: "heading", text, owner}
 */
export function parseRecipeTxt(raw) {
  const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const steps = [];
  let currentOwner = null;
  let current = null;
  let stepNum = 0;

  function flush() {
    if (current) {
      steps.push(current);
      current = null;
    }
  }

  for (const line of lines) {
    if (line.startsWith("#")) continue; // metadata comment, skip

    const imgMatch = line.match(/^\[([^\]]+\.\w+)\]$/);
    if (imgMatch) {
      flush();
      stepNum++;
      current = { id: `s${stepNum}`, type: "image", file: imgMatch[1] };
      continue;
    }

    if (line.startsWith("@")) {
      flush();
      currentOwner = line.slice(1).trim() || null;
      continue;
    }

    const numMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      flush();
      stepNum++;
      current = {
        id: `s${stepNum}`,
        type: "action",
        text: numMatch[2],
        owner: currentOwner,
      };
      continue;
    }

    if (line.startsWith("> ") && current && (current.type === "action" || current.type === "heading")) {
      current.text += "\n" + line.slice(2).trim();
      continue;
    }

    if (line.startsWith("- ") && current && (current.type === "action" || current.type === "checklist")) {
      if (current.type === "action") {
        current.type = "checklist";
        current.items = [];
      }
      current.items.push(line.slice(2).trim());
      continue;
    }

    // Plain line = heading / title
    flush();
    current = {
      id: `h${steps.length + 1}`,
      type: "heading",
      text: line,
      owner: currentOwner,
    };
  }

  flush();
  return steps;
}

/**
 * Serialize step objects back to plain text (for the recipe editor textarea).
 * Only needed when generating initial text from legacy JSON steps.
 */
export function serializeRecipeTxt(steps) {
  const lines = [];
  let lastOwner = undefined;
  let num = 0;

  for (const step of steps) {
    if (step.owner !== lastOwner) {
      if (lastOwner !== undefined) lines.push("");
      if (step.owner) lines.push(`@${step.owner}`);
      lastOwner = step.owner;
    }
    if (step.type === "heading") {
      lines.push(step.text);
    } else {
      num++;
      lines.push(`${num}. ${step.text}`);
      for (const item of step.items ?? []) {
        lines.push(`- ${item}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Resolve which group member owns a step.
 * Falls back to the active student when no group is configured.
 */
export function resolveStepOwner(ownerName, group, student) {
  if (ownerName) {
    const member = group?.find((m) => m.name === ownerName);
    return member ?? { id: null, name: ownerName, photoDataUrl: null };
  }
  if (!group?.length && student) {
    return { id: student.id, name: student.name, photoDataUrl: student.photo ?? null };
  }
  return null;
}

/**
 * Scale ingredient quantities in text marked with {N} syntax.
 * {2} with portions=3 → "6", {0.5} with portions=4 → "2".
 */
export function applyPortions(text, portions) {
  const factor = portions || 1;
  return text.replace(/\{(\d+(?:\.\d+)?)\}/g, (_, n) => {
    const result = parseFloat(n) * factor;
    return Number.isInteger(result) ? String(result) : String(parseFloat(result.toFixed(2)));
  });
}

/**
 * Resolve all owners of a step (supports multiple assignees).
 * Falls back to the active student when no group is configured.
 */
export function resolveStepOwners(ownerNames, group, student) {
  if (ownerNames?.length) {
    return ownerNames.map((name) => {
      const member = group?.find((m) => m.name === name);
      return member ?? { id: null, name, photoDataUrl: null };
    });
  }
  if (!group?.length && student) {
    return [{ id: student.id, name: student.name, photoDataUrl: student.photo ?? null }];
  }
  return [];
}
