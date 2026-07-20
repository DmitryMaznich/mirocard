export function getMinuteLabel(value) {
  const safeValue = Math.max(0, Math.floor(value));
  const lastDigit = safeValue % 10;
  const lastTwoDigits = safeValue % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "минут";
  if (lastDigit === 1) return "минута";
  if (lastDigit >= 2 && lastDigit <= 4) return "минуты";
  return "минут";
}
