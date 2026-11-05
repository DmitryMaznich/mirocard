import { readFile, writeFile } from 'node:fs/promises';
const base = 'content/reading_short_stories/micro/';
const draft = JSON.parse(await readFile(base + 'editorial-draft.json', 'utf8'));
const old = JSON.parse(await readFile(base + 'stories.json', 'utf8'));
const dictionary = new Map(old.flatMap(s => s.lines.flatMap(line => line.match(/[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*/g) ?? []))
  .map(word => [word.replaceAll('-', '').toLowerCase(), word.toLowerCase()]));
for (const word of 'и иг-рать вер-ну-ла те-перь о-ли чи-сты-е су-хи-е что нет ста-кан на-лил кра-на вы-лил пить ми-ски до-ри-со-вал боль-ша-я о-ста-но-вил-ся пе-ред лу-жей тра-ве ку-пи-ли про-дук-ты ма-га-зи-не сло-жи-ла да-вай по-мо-гу по-не-сли па-ке-ты ди-ва-не ко-тё-нок по-гла-ди-ла ко-тён-ка за-прыг-нул ко-ле-ни ус-нул бро-сил спа-си-бо'.split(' ')) {
  dictionary.set(word.replaceAll('-', ''), word);
}
const templatePath = 'docs/design/reading-sheet-illustrations.template.json';
const template = JSON.parse(await readFile(templatePath, 'utf8'));
const source = draft.stories.map(story => {
  if (story.textStatus !== 'agreed' || story.questionsStatus !== 'agreed') throw new Error('Unagreed: ' + story.id);
  const previous = old.find(s => s.id === story.id);
  if (story.illustration?.source) {
    template.stories[story.id] = { ...template.stories[story.id], source: story.illustration.source.split('/').at(-1) };
  }
  // The legacy collection already contains a story named «Помощь маме».
  // Give this micro-story its own unambiguous heading; its text is unchanged.
  const title = story.id === 'micro_bag' ? 'Оля помогает маме' : story.title;
  const lines = story.lines.map(line => line.replace(/[А-Яа-яЁё]+/g, word => {
    const value = dictionary.get(word.toLowerCase());
    if (!value) throw new Error('Missing authored syllables: ' + word);
    return word[0] === word[0].toUpperCase() ? value[0].toUpperCase() + value.slice(1) : value;
  }));
  for (let i = 0; i < lines.length; i++) if (lines[i].replace(/(\p{L})-(?=\p{L})/gu, '$1') !== story.lines[i]) throw new Error('Text drift: ' + story.id);
  const questions = story.questions.map(q => {
    const targets = [...q.acceptedAnswers].sort((a, b) => a.length - b.length);
    return { ...q, targets };
  });
  return { id: story.id, title, character: story.questions[0].acceptedAnswers[0], lines,
    find: questions.map(q => [q.question, q.targets[0]]),
    questions: questions.map(q => ({ prompt: q.question, targets: q.targets })),
    frames: story.illustration?.frames ?? previous.frames };
});
await writeFile(base + 'stories.json', JSON.stringify(source, null, 2) + '\n');
await writeFile(templatePath, JSON.stringify(template, null, 2) + '\n');
console.log('Synced ' + source.length + ' stories and ' + source.reduce((n, s) => n + s.find.length, 0) + ' questions.');
