// Synthesizes the built-in instruction library directly from
// content/instructions/*.txt, bundled at build time — same approach
// as builtinRecipesTopic.js (no ZIP, no catalog entry, no install step).
// Source format mirrors recipes' own .txt convention: "# key: value"
// headers, then the first plain line is the title, then numbered steps.
// See docs/superpowers/specs/2026-07-12-instructions-design.md.

const instructionFiles = import.meta.glob('../../content/instructions/*.txt', {
  eager: true,
  query: '?raw',
  import: 'default',
});

function extractTitle(txt) {
  for (const rawLine of txt.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^\d+\.\s/.test(line)) break; // reached the steps, no title line found
    return line;
  }
  return '';
}

function parseHeaderField(txt, prefix) {
  for (const rawLine of txt.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('#')) continue;
    const kv = line.slice(1).trim();
    if (kv.startsWith(prefix)) return kv.slice(prefix.length).trim();
  }
  return null;
}

function extractSteps(txt) {
  const steps = [];
  for (const rawLine of txt.split('\n')) {
    const match = rawLine.trim().match(/^\d+\.\s*(.+)$/);
    if (match) steps.push({ text: match[1].trim(), photo: null });
  }
  return steps;
}

export const BUILTIN_INSTRUCTIONS = Object.entries(instructionFiles)
  .map(([path, content]) => {
    const id = path.split('/').pop().replace(/\.txt$/, '');
    return {
      id,
      title: extractTitle(content),
      emoji: parseHeaderField(content, 'emoji:') ?? '📋',
      steps: extractSteps(content),
      builtin: true,
      updatedAt: 0,
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
