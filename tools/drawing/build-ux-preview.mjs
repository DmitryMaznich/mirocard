// Build the self-contained design preview from the current topic ZIP.
// The only player extension is restore(), used for preview navigation/progress.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';

const root = new URL('../../', import.meta.url);
const staging = new URL('output/drawing-ux/', root);
await mkdir(staging, { recursive: true });
const manifest = JSON.parse(await readFile(new URL('tools/drawing/topic.json', root), 'utf8'));
const zip = await JSZip.loadAsync(await readFile(new URL(`public/decks/drawing_v${manifest.meta.version}.zip`, root)));
const compiled = JSON.parse(await zip.file('topic.json').async('string'));
for (const card of compiled.cards) card.cover = await zip.file(card.image).async('string');
await writeFile(new URL('data.json', staging), JSON.stringify(compiled.cards));
await writeFile(new URL('index.html', staging), await readFile(new URL('tools/drawing/ux-preview.html', root)));
let player = await readFile(new URL('src/topics/renderers/drawing/player.js', root), 'utf8');
const marker = '    next,\n';
if (player.split(marker).length !== 2) throw new Error('Preview restore insertion point changed');
player = player.replace(marker, marker+'    restore(value) { stop(); index=Math.max(0,Math.min(steps.length,Number(value)||0)); redraw(); emit(); },\n');
await writeFile(new URL('previewPlayer.js', staging), player);
await writeFile(new URL('finale.js', staging), await readFile(new URL('src/topics/renderers/drawing/finale.js', root)));
await writeFile(new URL('pencilSound.js', staging), await readFile(new URL('src/topics/renderers/drawing/pencilSound.js', root)));
await writeFile(new URL('vite.config.mjs', staging), `import { defineConfig } from 'vite';import {viteSingleFile} from 'vite-plugin-singlefile';import {fileURLToPath} from 'node:url';export default defineConfig({root:fileURLToPath(new URL('./',import.meta.url)),publicDir:false,plugins:[viteSingleFile()],build:{outDir:'dist',emptyOutDir:true}});\n`);
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'output/drawing-ux/vite.config.mjs'], { cwd: fileURLToPath(root), stdio: 'inherit' });
const html = await readFile(new URL('dist/index.html', staging));
await writeFile(new URL('docs/mockups/drawing/lesson-ux.html', root), html);
console.log('Updated docs/mockups/drawing/lesson-ux.html');
