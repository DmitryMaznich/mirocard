import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, basename } from 'node:path';
import { transferCards } from '../../src/topics/wordFormationTransfer.js';
const catalog = JSON.parse(readFileSync('public/decks/catalog.json', 'utf8'));
const deck = catalog.decks.find(d => d.id === 'word_formation_soup');
const zip = await JSZip.loadAsync(readFileSync(resolve('public/decks', basename(deck.file))));
const topic = JSON.parse(await zip.file('topic.json').async('string'));
// Real deck text and images, without account or backend dependencies.
async function media(value) {
  if (Array.isArray(value)) return Promise.all(value.map(media));
  if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k,v]) => [k, await media(v)])));
  if (typeof value === 'string' && /\.(webp|png|jpg|svg)$/.test(value) && zip.file(value)) {
    const type = value.endsWith('.svg') ? 'svg+xml' : value.split('.').at(-1);
    return `data:image/${type};base64,${await zip.file(value).async('base64')}`;
  }
  return value;
}
const cards = await media(topic.cards);
const regular = cards.filter(c => !c.items);
const season = cards.find(c => c.items);
const longest = [...regular].sort((a,b) => (b.nounPhrase + b.adjPhrase).length - (a.nounPhrase + a.adjPhrase).length)[0];
const soup = regular.find(c => c.vesselImage) ?? regular[0];
const choices = regular.filter(c => c.category === soup.category);
const newMaterial = transferCards(regular.filter(c => c.id === 'dom_derevo'))[0];
const newSeason = transferCards([season])[0];
const tasks = [
  { type: 'season_form_pick', card: soup, item: { id: 'agreement_1', noun: 'котлета', dishKind: 'cutlet', sourcePhrase: 'котлета из рыбы', adjPhrase: 'рыбная котлета' }, params: { optionCount: 4 } },
  { type: 'season_form_pick', card: soup, item: { id: 'agreement_2', noun: 'блюдо', dishKind: 'dish', sourcePhrase: 'блюдо из рыбы', adjPhrase: 'рыбное блюдо' }, params: { optionCount: 2, activityStage: 'check' } },
  { type: 'pair_intro', cards: [newMaterial], params: { introStage: 'answer', materialSet: 'transfer' } },
  { type: 'pick_form', card: newMaterial, options: [{ text: 'деревянный', isTarget: true }, { text: 'стеклянный', isTarget: false }], params: { showImage: false } },
  { type: 'season_form_pick', card: newSeason, item: newSeason.items[2], params: { activityStage: 'check', optionCount: 4 } },
  { type: 'pair_intro', cards: [longest] },
  { type: 'pair_intro', cards: [soup] },
  { type: 'pair_intro', cards: [longest], params: { introStage: 'answer' } },
  { type: 'pick_form', card: soup, allCards: choices, params: { optionCount: 4 } },
  { type: 'pick_form', card: longest, allCards: regular, params: { showImage: false, hintMode: 'noun_only', difficulty: 'hard' } },
  { type: 'season_overview', card: season },
  { type: 'season_pick_items', card: season, chips: season.items },
  { type: 'season_pick_items', card: season, chips: season.items, params: { hideOptionImages: true } },
  { type: 'season_form_pick', card: season, item: season.items[0], params: { optionCount: 4 } },
  { type: 'season_form_pick', card: season, item: season.items[0], params: { optionCount: 2, questionHint: false } },
  { type: 'pick_form', card: regular.find(c => c.category === 'weather'), allCards: regular, params: { optionCount: 3, showImage: false, hintMode: 'noun_only' } },
  { type: 'form_it', stimulus: 'image', stimulusImage: soup.ingredientImage, options: regular.slice(0,4) },
  { type: 'form_it', stimulus: 'phrase', stimulusText: longest.nounPhrase, options: regular.slice(0,4) },
  { type: 'yes_no', image: soup.ingredientImage, displayPhrase: longest.adjPhrase },
  { type: 'question_ask', stimulusImage: soup.ingredientImage, stimulusText: longest.nounPhrase, correctAdjPhrase: longest.adjPhrase },
  ...['juice', 'jam', 'kasha', 'materials', 'weather'].flatMap(category => {
    const card = regular.find(c => c.category === category);
    return [{ type: 'pair_intro', cards: [card] },
      { type: 'pick_form', card, allCards: regular, params: { optionCount: 4 } }];
  }),
];
for (const [width,height] of [[768,1024],[1024,768],[600,960],[960,600],[820,1180],[1180,820],[375,667],[667,375],[390,844],[844,390],[320,568],[568,320]]) {
  test(`${width}x${height}: all task layouts fit and resize`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(pathToFileURL(resolve('.cache/word-formation-responsive/tests/responsive/word-formation.html')).href);
    await page.waitForFunction(() => !!window.mountTask);
    for (const [index,task] of tasks.entries()) {
      await page.evaluate(task => window.mountTask(task), task);
      await page.locator('.wf-viewport > div').waitFor();
      await page.waitForTimeout(80);
      const checkLayout = () => {
        const root = document.querySelector('.wf-viewport');
        const bounds = root.getBoundingClientRect();
        const issues = [];
        for (const el of root.querySelectorAll('*')) {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0' || !el.getClientRects().length) continue;
          const r = el.getBoundingClientRect();
          if (r.left < bounds.left - 1 || r.right > bounds.right + 1 || r.bottom > bounds.bottom + 1 || r.top < bounds.top - 1) issues.push(`${el.className}: outside task area`);
          if (el.scrollHeight > el.clientHeight + 1 && ['auto','scroll'].includes(cs.overflowY)) issues.push(`${el.className}: vertical scroll ${el.scrollHeight}/${el.clientHeight}`);
          if (el.scrollWidth > el.clientWidth + 1 && el.children.length === 0) issues.push(`${el.className}: text overflow`);
          if (el.tagName === 'BUTTON' && r.height < 43) issues.push(`${el.className}: short touch target`);
        }
        return issues;
      };
      const errors = await page.evaluate(checkLayout);
      expect(errors, `task ${index}: ${task.type}`).toEqual([]);
      if ([600,375,667].includes(width) && [2,4,7].includes(index)) {
        await page.screenshot({ path: `.cache/word-formation-${width}x${height}-${task.type}.png` });
      }
      // Rotate the current task without advancing or remounting it.
      await page.setViewportSize({ width: height, height: width });
      await page.waitForTimeout(50);
      expect(await page.evaluate(checkLayout), `rotated task ${index}: ${task.type}`).toEqual([]);
      await page.setViewportSize({ width, height });
    }
  });
}


// Selecting several categories must not increase the number of choices.
test('soup demo: meaning, selection, agreement and independent answer work', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(pathToFileURL(resolve('docs/design/word-formation-soup-preview.html')).href);
  await expect(page.locator('.wf-preview__categories button')).toHaveCount(7);
  await page.screenshot({ path: '.cache/word-formation-topic-overview.png' });
  await page.getByRole('button', { name: 'Суп 10 сочетаний', exact: true }).click();
  await expect(page.locator('.wf-meaning__figure')).toHaveCount(2);
  await expect(page.locator('.wf-listen')).toHaveCount(0);
  await expect(page.locator('.wf-lesson__model')).toContainText('рыбный суп');
  await page.screenshot({ path: '.cache/word-formation-soup-model.png' });
  await expect(page.locator('.wf-pair__prompt-line')).toHaveText('Суп из рыбы');
  await page.getByRole('button', { name: 'Выбор прилагательного', exact: true }).click();
  const fishChoice = await page.getByLabel('Задание').locator('option').evaluateAll(options => options.find(o => o.textContent.includes('суп из рыбы')).value);
  await page.getByLabel('Задание').selectOption(fishChoice);
  await expect(page.locator('.wf-lesson__model')).toHaveCount(0);
  await page.getByRole('button', { name: 'рыбный', exact: true }).click();
  await expect(page.locator('.wf-lesson__model')).toContainText('рыбный суп');
  await page.getByRole('button', { name: 'Согласование', exact: true }).click();
  const fishCutlet = await page.getByLabel('Задание').locator('option').evaluateAll(options => options.find(o => o.textContent.includes('котлета из рыбы')).value);
  await page.getByLabel('Задание').selectOption(fishCutlet);
  await expect(page.locator('.wf-sfp__label--q')).toContainText('котлета какая?');
  await page.screenshot({ path: '.cache/word-formation-soup-agreement.png' });
  await page.getByLabel('Этап согласования').selectOption('check');
  const checkingCutlet = await page.getByLabel('Задание').locator('option').evaluateAll(options => options.find(o => o.textContent.includes('котлета из рыбы')).value);
  await page.getByLabel('Задание').selectOption(checkingCutlet);
  await expect(page.locator('.wf-sfp__label--q')).toHaveText('котлета');
  await page.getByRole('button', { name: 'Знакомство', exact: true }).click();
  await page.getByLabel('Этап', { exact: true }).selectOption('answer');
  await expect(page.locator('.wf-lesson__model')).toHaveCount(0);
  await expect(page.locator('.wf-lesson__adult')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Попробовать|Показать образец|Самостоятельно/ })).toHaveCount(0);
  for (const category of ['juice', 'jam', 'kasha', 'materials', 'weather', 'seasons']) {
    await page.getByLabel('Категория').selectOption(category);
    await expect(page.locator('.wf-pair__prompt-line')).toBeVisible();
    await page.getByRole('button', { name: 'Выбор прилагательного', exact: true }).click();
    expect(await page.locator('.wf-pick__option').count()).toBeGreaterThanOrEqual(2);
    expect(await page.locator('.wf-pair__prompt-line').textContent()).not.toContain('(');
  }
  await page.getByRole('button', { name: 'Согласование', exact: true }).click();
  await expect(page.locator('.wf-sfp')).toBeVisible();
  await page.setViewportSize({ width: 375, height: 667 });
  await page.getByRole('button', { name: '← Вся тема', exact: true }).click();
  await expect(page.locator('.wf-preview__categories button')).toHaveCount(7);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('tablet app preview: actual viewport rotates without extra demo controls in the lesson', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const url = pathToFileURL(resolve('docs/design/word-formation-topic-preview.html')).href;
  await page.goto(url + '?tablet=1');
  const lesson = page.frameLocator('iframe');
  await expect(lesson.locator('.session-subtitle')).toContainText('Знакомство с парами');
  await expect(lesson.locator('.wf-preview__settings')).toHaveCount(0);
  await expect(lesson.locator('.wf-lesson__actions')).toHaveCount(0);
  await lesson.getByRole('button', { name: 'Открыть настройки режима', exact: true }).click();
  await lesson.getByLabel('Предъявление в настройках').selectOption('answer');
  await lesson.getByRole('button', { name: 'Вернуться к занятию', exact: true }).click();
  await expect(lesson.locator('.wf-lesson__model')).toHaveCount(0);
  await expect(lesson.locator('.wf-lesson__adult')).toHaveCount(0);
  expect(await lesson.locator('body').evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([768, 1024]);
  await page.screenshot({ path: '.cache/word-formation-tablet-portrait-frame.png' });
  await page.getByRole('button', { name: 'Повернуть планшет', exact: true }).click();
  expect(await lesson.locator('body').evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([1024, 768]);
  await page.getByLabel('Режим планшета').selectOption('pick_form');
  await expect(lesson.locator('.wf-pick__option')).toHaveCount(2);
  await page.screenshot({ path: '.cache/word-formation-tablet-landscape-frame.png' });
  await page.getByLabel('Режим планшета').selectOption('season_form_pick');
  await expect(lesson.locator('.wf-sfp--food')).toBeVisible();
  await page.getByRole('button', { name: 'Следующее →', exact: true }).click();
  await expect(lesson.locator('.session-counter')).toContainText('2 /');
  await page.getByLabel('Маленький планшет').check();
  expect(await lesson.locator('body').evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([960, 600]);
  await page.goto(url + '?app=1');
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.locator('.wf-meaning__figure')).toHaveCount(2);
  await page.screenshot({ path: '.cache/word-formation-tablet-768x1024.png' });
  await page.goto(url + '?app=1&mode=pick_form');
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator('.wf-pick__option')).toHaveCount(2);
  await page.screenshot({ path: '.cache/word-formation-tablet-1024x768.png' });
});

test('many categories: only two choices by default on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(pathToFileURL(resolve('.cache/word-formation-responsive/tests/responsive/word-formation.html')).href);
  await page.waitForFunction(() => !!window.mountTask);
  await page.evaluate(task => window.mountTask(task), { type: 'pick_form', card: soup, allCards: regular });
  const buttons = page.locator('.wf-pick__option');
  await expect(buttons).toHaveCount(2);
  for (const button of [buttons.first(), buttons.last(), buttons.first()]) {
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(668);
  }
  expect(await page.locator('.wf-pair').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
});


test('mode settings: choices, images and checking are controlled outside the child screen', async ({ page }) => {
  const url = pathToFileURL(resolve('docs/design/word-formation-topic-preview.html')).href;
  await page.setViewportSize({ width: 600, height: 960 });
  await page.goto(url + '?app=1&mode=pick_form');
  await page.getByRole('button', { name: 'Открыть настройки режима', exact: true }).click();
  await page.getByLabel('Вариантов ответа').selectOption('4');
  await page.getByLabel('Показывать изображения', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Вернуться к занятию', exact: true }).click();
  await expect(page.locator('.wf-pick__option')).toHaveCount(4);
  await expect(page.locator('.wf-meaning')).toHaveCount(0);
  await expect(page.locator('.wf-pair__prompt')).toContainText('Суп из');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(url + '?app=1&mode=season_form_pick');
  await page.getByRole('button', { name: 'Открыть настройки режима', exact: true }).click();
  await page.getByLabel('Этап согласования').selectOption('check');
  await expect(page.getByLabel('Вопрос-подсказка', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Вернуться к занятию', exact: true }).click();
  await expect(page.locator('.wf-sfp--check')).toBeVisible();
  await expect(page.locator('.wf-sfp__label--q')).not.toContainText('?');
});
