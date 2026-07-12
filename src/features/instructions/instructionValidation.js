export function validateInstructionDraft(draft) {
  const errors = {};

  if (!draft.title || !draft.title.trim()) {
    errors.title = 'Введите название';
  }

  const nonEmptySteps = (draft.steps ?? []).map((s) => s.trim()).filter(Boolean);
  if (nonEmptySteps.length === 0) {
    errors.steps = 'Добавьте хотя бы один шаг';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
