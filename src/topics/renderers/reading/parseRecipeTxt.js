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
export function applyPortions(text, portions) {
  if (!text) return text ?? "";
  const factor = portions || 1;
  let result = text.replace(
    /\{(\d+(?:\.\d+)?)\|([^|}]+)\|([^|}]+)\|([^|}]+)\}/g,
    (_, n, one, few, many) => {
      const val = parseFloat(n) * factor;
      const rounded = Number.isInteger(val) ? val : parseFloat(val.toFixed(2));
      return `${rounded} ${pluralizeRu(rounded, one.trim(), few.trim(), many.trim())}`;
    }
  );
  result = result.replace(/\{(\d+(?:\.\d+)?)\}/g, (_, n) => {
    const val = parseFloat(n) * factor;
    return Number.isInteger(val) ? String(val) : String(parseFloat(val.toFixed(2)));
  });
  return result;
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
