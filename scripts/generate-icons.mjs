import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

// The mirocard-mark path (same silhouette used on the splash screen)
const markPath =
  "M 98.0 0.0 L 376.0 0.0 L 401.0 5.0 L 401.0 7.0 L 388.0 12.0 L 382.0 20.0 L 379.0 17.0 L 369.0 15.0 L 342.0 24.0 L 319.0 23.0 L 291.0 29.0 L 291.0 31.0 L 297.0 29.0 L 313.0 29.0 L 313.0 31.0 L 279.0 41.0 L 229.0 67.0 L 219.0 67.0 L 209.0 61.0 L 215.0 69.0 L 233.0 71.0 L 245.0 67.0 L 265.0 55.0 L 268.0 56.0 L 247.0 71.0 L 204.0 88.0 L 198.0 96.0 L 196.0 112.0 L 200.0 102.0 L 209.0 93.0 L 219.0 91.0 L 206.0 102.0 L 199.0 125.0 L 188.0 136.0 L 200.0 132.0 L 194.0 142.0 L 193.0 151.0 L 201.0 143.0 L 198.0 156.0 L 203.0 167.0 L 206.0 148.0 L 209.0 147.0 L 207.0 151.0 L 209.0 155.0 L 216.0 150.0 L 213.0 159.0 L 214.0 200.0 L 212.0 206.0 L 196.0 224.0 L 176.0 236.0 L 171.0 245.0 L 173.0 255.0 L 191.0 273.0 L 190.0 284.0 L 185.0 289.0 L 186.0 296.0 L 197.0 303.0 L 198.0 310.0 L 209.0 311.0 L 213.0 309.0 L 215.0 311.0 L 212.0 316.0 L 199.0 317.0 L 194.0 322.0 L 195.0 331.0 L 202.0 338.0 L 204.0 344.0 L 203.0 365.0 L 205.0 375.0 L 214.0 386.0 L 224.0 390.0 L 274.0 390.0 L 294.0 396.0 L 304.0 406.0 L 311.0 421.0 L 316.0 440.0 L 92.0 440.0 L 75.0 435.0 L 54.0 422.0 L 42.0 408.0 L 35.0 395.0 L 30.0 374.0 L 31.0 61.0 L 40.0 36.0 L 59.0 15.0 L 77.0 5.0 Z";

// Same aesthetic as the splash screen: deep navy background, soft blue
// aurora glow, white silhouette mark. `paddingRatio` controls how much
// breathing room the mark gets — larger for maskable icons, which must
// survive being cropped to a circle/squircle by the OS launcher.
function buildIconSvg(size, paddingRatio) {
  const padding = size * paddingRatio;
  const available = size - padding * 2;
  const scale = Math.min(available / 496, available / 440);
  const w = 496 * scale;
  const h = 440 * scale;
  const tx = (size - w) / 2;
  const ty = (size - h) / 2;
  const glowR = size * 0.42;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="#12244e"/>
      <stop offset="100%" stop-color="#080f20"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#4a9eff" stop-opacity="0.55"/>
      <stop offset="55%" stop-color="#3d7ec8" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#3d7ec8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <circle cx="${size / 2}" cy="${ty + h * 0.46}" r="${glowR}" fill="url(#glow)"/>
  <g transform="translate(${tx}, ${ty}) scale(${scale})">
    <path d="${markPath}" fill="#ffffff"/>
  </g>
</svg>`;
}

async function generate(size, filename, paddingRatio) {
  const svg = buildIconSvg(size, paddingRatio);
  await sharp(Buffer.from(svg)).png().toFile(join(root, "public", filename));
  console.log(`Generated ${filename} (${size}x${size}, padding ${Math.round(paddingRatio * 100)}%)`);
}

// icon-512 carries purpose="any maskable" in manifest.json — give it a
// generous safe zone. icon-192 / apple-touch-icon are "any" only, so
// they can run closer to full bleed.
await generate(192, "icon-192.png", 0.11);
await generate(512, "icon-512.png", 0.19);
await generate(180, "apple-touch-icon.png", 0.11);

console.log("Done.");
