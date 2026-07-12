// Synthesizes the built-in instruction library directly from
// content/instructions/*.json, bundled at build time — same approach
// as builtinRecipesTopic.js (no ZIP, no catalog entry, no install step).
// See docs/superpowers/specs/2026-07-12-instructions-design.md.

const instructionModules = import.meta.glob('../../content/instructions/*.json', {
  eager: true,
});

export const BUILTIN_INSTRUCTIONS = Object.entries(instructionModules)
  .map(([path, mod]) => {
    const id = path.split('/').pop().replace(/\.json$/, '');
    const data = mod.default;
    return {
      id,
      title: data.title,
      emoji: data.emoji,
      steps: data.steps,
      builtin: true,
      updatedAt: 0,
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
