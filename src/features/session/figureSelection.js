export const MIN_FIGURES_FOR_REWARD = 5;

export function requiredFigureSelectionCount(availableCount) {
  return Math.min(MIN_FIGURES_FOR_REWARD, Math.max(0, Number(availableCount) || 0));
}

export function hasMinimumFigureSelection(selectedCount, availableCount) {
  return Number(selectedCount) >= requiredFigureSelectionCount(availableCount);
}
