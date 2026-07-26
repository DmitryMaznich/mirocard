// Unlike a single digit 0-9 (identify_number's/regroup_ten's counters, which
// used to need this plural form before the live counter was removed),
// build_number's raw coin count is the FULL target number (up to
// maxTens*10+maxOnes, e.g. 28 or 14) — so this one does need the
// teen-number exception, or "14 монеты" would come out instead of "14 монет".
export function pluralCoins(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "монет";
  const mod10 = n % 10;
  if (mod10 === 1) return "монету";
  if (mod10 >= 2 && mod10 <= 4) return "монеты";
  return "монет";
}

// Shared by every place-value mode with a digit-entry answer step
// (BuildNumberTask, IdentifyNumberTask): direction is purely a function of
// the wrong digit vs the target, no component state involved.
export function hintDirectionFor(guess, target) {
  return guess < target ? "more" : "less";
}
