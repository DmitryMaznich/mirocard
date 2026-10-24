// Snapshot of comparison 2.37.0 pair mechanics. No language or account state.
const MAX_ATTEMPTS = 100;
function isValidPair(left, right, minDiff, allowEqual) {
  if (left === right) return allowEqual;
  return Math.abs(left - right) >= minDiff;
}

export function generateComparisonTask(params, usedPairs) {
  const { min = 1, max = 10, minDiff = 1, allowEqual = false } = params;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const left  = Math.floor(Math.random() * (max - min + 1)) + min;
    const right = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!isValidPair(left, right, minDiff, allowEqual)) continue;
    // Avoid handing back the exact same pair twice within one generated batch —
    // independent random draws otherwise repeat far more often than a
    // parent/child expects, especially at the narrower difficulty levels.
    const key = `${left},${right}`;
    if (usedPairs?.has(key)) continue;
    usedPairs?.add(key);
    return { left, right };
  }

  if (usedPairs) {
    // MAX_ATTEMPTS random draws all collided with usedPairs — the pool of
    // valid pairs for this range/minDiff is small relative to how many
    // tasks are being generated (e.g. level 1's ~30 pairs vs. a 500-task
    // session). Scan for any still-unused valid pair instead of falling
    // back to one fixed pair, which used to repeat identically for every
    // remaining task once the pool ran out.
    const unused   = [];
    const allValid = [];
    for (let l = min; l <= max; l++) {
      for (let r = min; r <= max; r++) {
        if (!isValidPair(l, r, minDiff, allowEqual)) continue;
        allValid.push({ left: l, right: r });
        if (!usedPairs.has(`${l},${r}`)) unused.push({ left: l, right: r });
      }
    }
    if (unused.length) {
      const pick = unused[Math.floor(Math.random() * unused.length)];
      usedPairs.add(`${pick.left},${pick.right}`);
      return pick;
    }
    // Every valid pair has already been used at least once — a repeat is
    // unavoidable, but pick one at random rather than always the same
    // fixed pair, so which pair repeats varies from task to task.
    if (allValid.length) {
      return allValid[Math.floor(Math.random() * allValid.length)];
    }
  }

  const left  = min;
  const right = Math.min(min + (minDiff || 1), max);
  return { left, right };
}
