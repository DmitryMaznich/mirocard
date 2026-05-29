import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIROCARD2 = path.resolve(__dirname, '..');
const GENERATED = path.resolve(MIROCARD2, '../Mirocard/cardgen-studio/projects/coffee_espresso_parts/generated');

// ─────────────────────────────────────────────────────
// 1. Convert real photos → 1024×1024 WebP
// ─────────────────────────────────────────────────────
async function convertPhotos() {
  const map = [
    ['Vetrano2B_Evo_HotWaterTap.webp', 'hot_water_tap_1.webp'],
    ['Vetrano2B_Evo_PouringLever.webp', 'brew_lever_1.webp'],
    ['Vetrano2B_Evo_SwitchOnOFf.webp', 'toggle_switch_1.webp'],
    ['Vetrano2B_Evo_manometer.webp', 'pressure_gauge_1.webp'],
    ['Vetrano_poddon.png', 'drip_tray_1.webp'],
    ['Vetrano_water_tank.jpg', 'water_reservoir_1.webp'],
  ];

  for (const [src, dst] of map) {
    const srcPath = path.join(MIROCARD2, src);
    const dstPath = path.join(GENERATED, dst);
    await sharp(srcPath)
      .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .webp({ quality: 90 })
      .toFile(dstPath);
    console.log(`  ✓  ${src}  →  ${dst}`);
  }
}

// ─────────────────────────────────────────────────────
// 2. Annotated hero diagram (SVG overlay via sharp)
// ─────────────────────────────────────────────────────
async function createAnnotatedDiagram() {
  const IMG = 1500;
  const PAD_L = 320, PAD_R = 320, PAD_T = 80, PAD_B = 160;
  const CW = IMG + PAD_L + PAD_R;   // 2140
  const CH = IMG + PAD_T + PAD_B;   // 1740

  // Dot positions in original-image coordinates (1500×1500)
  // Translated to canvas: add (PAD_L, PAD_T)
  const items = [
    {
      id: 'steam_wand',
      label: 'Паровик',
      dot: [90, 358],   // tip of steam wand
      side: 'left',
    },
    {
      id: 'brew_lever',
      label: 'Рычаг пролива',
      dot: [500, 478],  // E61 lever at top of group head
      side: 'left',
    },
    {
      id: 'portafilter',
      label: 'Холдер',
      dot: [118, 688],  // portafilter handle tip
      side: 'left',
    },
    {
      id: 'manometer',
      label: 'Манометр',
      dot: [352, 810],  // round gauge (blue ring)
      side: 'left',
    },
    {
      id: 'toggles',
      label: 'Тумблеры включения',
      dot: [534, 408],  // toggle switches on front panel
      side: 'right',
    },
    {
      id: 'vapore',
      label: 'Кран паровика',
      dot: [888, 390],  // VAPORE knob
      side: 'right',
    },
    {
      id: 'hot_water',
      label: 'Кран горячей воды',
      dot: [902, 618],  // ACQUA tap
      side: 'right',
    },
    {
      id: 'drip_tray',
      label: 'Поддон',
      dot: [582, 1095], // drip tray
      side: 'bottom',
    },
  ];

  // Style
  const ACCENT = '#1d4ed8';   // blue-700
  const DOT_R = 9;
  const LINE_W = 2;
  const FONT_SZ = 26;
  const LABEL_PAD_X = 16;
  const LABEL_PAD_Y = 10;
  const LABEL_H = FONT_SZ + LABEL_PAD_Y * 2;

  // Approximate Russian text widths in px (at 26px bold Arial)
  // 1 char ≈ 15px for Cyrillic uppercase/mixed
  function approxWidth(text) {
    return text.length * 15 + LABEL_PAD_X * 2;
  }

  // Assign Y positions for left and right columns to avoid overlap
  const leftItems  = items.filter(i => i.side === 'left');
  const rightItems = items.filter(i => i.side === 'right');

  // Sort by dot y so lines don't cross
  leftItems.sort((a, b) => a.dot[1] - b.dot[1]);
  rightItems.sort((a, b) => a.dot[1] - b.dot[1]);

  // Compute label box center-y: distribute evenly across vertical span
  function assignLabelY(arr, yMin, yMax) {
    const step = (yMax - yMin) / (arr.length + 1);
    arr.forEach((item, i) => {
      item.labelY = yMin + step * (i + 1);
    });
  }
  assignLabelY(leftItems,  PAD_T + 100, PAD_T + IMG - 80);
  assignLabelY(rightItems, PAD_T + 100, PAD_T + IMG - 300);

  // Build SVG
  let svgParts = [];

  function el(tag, attrs, inner = '') {
    const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    return inner ? `<${tag} ${a}>${inner}</${tag}>` : `<${tag} ${a}/>`;
  }

  for (const item of items) {
    const dx = item.dot[0] + PAD_L;
    const dy = item.dot[1] + PAD_T;

    if (item.side === 'bottom') {
      // vertical callout to bottom center
      const lx = dx;
      const ly = PAD_T + IMG + 50;
      const w = approxWidth(item.label);
      // line
      svgParts.push(el('line', {
        x1: dx, y1: dy + DOT_R,
        x2: lx, y2: ly,
        stroke: ACCENT, 'stroke-width': LINE_W, 'stroke-dasharray': '6 3', opacity: '0.8',
      }));
      // label box
      svgParts.push(el('rect', {
        x: lx - w / 2, y: ly,
        width: w, height: LABEL_H, rx: 8,
        fill: 'white', stroke: ACCENT, 'stroke-width': '1.5',
      }));
      svgParts.push(el('text', {
        x: lx, y: ly + LABEL_PAD_Y + FONT_SZ * 0.78,
        'text-anchor': 'middle',
        'font-family': 'Arial, Helvetica, sans-serif',
        'font-size': FONT_SZ, 'font-weight': 'bold',
        fill: ACCENT,
      }, item.label));
    } else if (item.side === 'left') {
      const lx = PAD_L - 20; // right edge of left column
      const ly = item.labelY;
      const w = approxWidth(item.label);
      // line: from right edge of label to dot
      svgParts.push(el('line', {
        x1: lx, y1: ly,
        x2: dx, y2: dy,
        stroke: ACCENT, 'stroke-width': LINE_W, 'stroke-dasharray': '6 3', opacity: '0.8',
      }));
      // label box (right-aligned to lx)
      svgParts.push(el('rect', {
        x: lx - w, y: ly - LABEL_H / 2,
        width: w, height: LABEL_H, rx: 8,
        fill: 'white', stroke: ACCENT, 'stroke-width': '1.5',
      }));
      svgParts.push(el('text', {
        x: lx - w / 2, y: ly + FONT_SZ * 0.38,
        'text-anchor': 'middle',
        'font-family': 'Arial, Helvetica, sans-serif',
        'font-size': FONT_SZ, 'font-weight': 'bold',
        fill: ACCENT,
      }, item.label));
    } else { // right
      const lx = PAD_L + IMG + 20; // left edge of right column
      const ly = item.labelY;
      const w = approxWidth(item.label);
      // line: from dot to left edge of label
      svgParts.push(el('line', {
        x1: dx, y1: dy,
        x2: lx, y2: ly,
        stroke: ACCENT, 'stroke-width': LINE_W, 'stroke-dasharray': '6 3', opacity: '0.8',
      }));
      // label box (left-aligned to lx)
      svgParts.push(el('rect', {
        x: lx, y: ly - LABEL_H / 2,
        width: w, height: LABEL_H, rx: 8,
        fill: 'white', stroke: ACCENT, 'stroke-width': '1.5',
      }));
      svgParts.push(el('text', {
        x: lx + w / 2, y: ly + FONT_SZ * 0.38,
        'text-anchor': 'middle',
        'font-family': 'Arial, Helvetica, sans-serif',
        'font-size': FONT_SZ, 'font-weight': 'bold',
        fill: ACCENT,
      }, item.label));
    }

    // Dot (drawn last so it's on top of lines)
    svgParts.push(el('circle', {
      cx: dx, cy: dy, r: DOT_R,
      fill: ACCENT, stroke: 'white', 'stroke-width': '2.5',
    }));
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}">${svgParts.join('\n')}</svg>`;

  // Composite: white canvas + hero image + SVG overlay
  const heroPath = path.join(MIROCARD2, 'vetrano-hero.webp');
  const outPath  = path.join(MIROCARD2, 'vetrano-annotated.webp');

  await sharp({
    create: { width: CW, height: CH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      { input: heroPath, left: PAD_L, top: PAD_T },
      { input: Buffer.from(svg), left: 0, top: 0 },
    ])
    .webp({ quality: 92 })
    .toFile(outPath);

  console.log(`  ✓  vetrano-annotated.webp  (${CW}×${CH})`);
}

// ─────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────
console.log('\n── Конвертация фото ──');
await convertPhotos();

console.log('\n── Аннотированная схема ──');
await createAnnotatedDiagram();

console.log('\nГотово.');
