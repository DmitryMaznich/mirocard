import JSZip from 'jszip';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve, basename } from 'node:path';
const catalog = JSON.parse(readFileSync('public/decks/catalog.json', 'utf8'));
const deck = catalog.decks.find(d => d.id === 'word_formation_soup');
const zip = await JSZip.loadAsync(readFileSync(resolve('public/decks', basename(deck.file))));
const topic = JSON.parse(await zip.file('topic.json').async('string'));
const urls = new Map();
async function embed(value) {
  if (Array.isArray(value)) return Promise.all(value.map(embed));
  if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, val]) => [key, await embed(val)])));
  if (typeof value === 'string' && /\.(webp|png|jpg|svg)$/.test(value) && zip.file(value)) {
    if (!urls.has(value)) urls.set(value, zip.file(value).async('base64').then(data => `data:image/${value.endsWith('.svg') ? 'svg+xml' : value.split('.').at(-1)};base64,${data}`));
    return urls.get(value);
  }
  return value;
}
const cards = await embed(topic.cards);
mkdirSync('.cache', { recursive: true });
writeFileSync('.cache/word-formation-preview-data.json', JSON.stringify(cards));
await build({ configFile: false, base: './', publicDir: false, plugins: [react(), viteSingleFile()],
  resolve: { alias: { '@': resolve('src') } },
  build: { outDir: '.cache/word-formation-preview', emptyOutDir: true, rollupOptions: { input: 'tests/responsive/word-formation-preview.html' } },
});
writeFileSync('docs/design/word-formation-soup-preview.html', readFileSync('.cache/word-formation-preview/tests/responsive/word-formation-preview.html'));
console.log('Preview: docs/design/word-formation-soup-preview.html');
writeFileSync('docs/design/word-formation-topic-preview.html', readFileSync('.cache/word-formation-preview/tests/responsive/word-formation-preview.html'));
