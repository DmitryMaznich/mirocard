// Authoring data keeps the video's order and timestamps. The downloadable
// lesson groups steps by the explicit pencil order, preserving order inside
// each colour. Put base coats before the pencils that add patterns over them.
export function planLesson(source, pencils) {
  const palette = (source.palette ?? []).map(id => {
    if (!pencils[id]) throw new Error(`Unknown pencil ${id} in ${source.id}`);
    return { ...pencils[id] };
  });
  if (new Set(palette.map(tool => tool.id)).size !== palette.length) throw new Error(`Duplicate pencil in ${source.id}`);
  if (palette[0]?.id !== "black") throw new Error(`The outline pencil must come first in ${source.id}`);
  const allowed = new Set(palette.map(tool => tool.id));
  for (const step of source.steps) {
    if (!allowed.has(step.tool)) throw new Error(`Missing pencil for ${source.id}: ${step.title}`);
    if (step.kind === "color" && step.fill.toLowerCase() !== pencils[step.tool].color.toLowerCase()) {
      throw new Error(`Pencil and fill disagree in ${source.id}: ${step.title}`);
    }
  }
  const steps = palette.flatMap(tool => source.steps.filter(step => step.tool === tool.id));
  return { ...source, palette, steps };
}

export function toolForStep(lesson, index) {
  const step = lesson?.steps?.[index];
  const tool = lesson?.palette?.find(tool => tool.id === step?.tool);
  if (!step || !tool) return null;
  let first = index, last = index;
  while (first > 0 && lesson.steps[first-1].tool === tool.id) first--;
  while (last+1 < lesson.steps.length && lesson.steps[last+1].tool === tool.id) last++;
  return { tool, first, last, position: index-first+1, total: last-first+1 };
}
