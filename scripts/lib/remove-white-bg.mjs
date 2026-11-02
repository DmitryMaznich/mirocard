import sharp from "sharp";

// White background → transparent: flood-fill from the edges over near-white
// pixels, feather the edge, trim. Lifted from generate-nakryt-na-stol.mjs so
// new generators can share it.
export async function removeWhiteBg(buf, tolerance = 38) {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const px          = new Uint8ClampedArray(data);
  const transparent = new Uint8Array(width * height);
  const visited     = new Uint8Array(width * height);
  const queue       = new Int32Array(width * height);
  let qHead = 0, qTail = 0;

  const isWhitish = (i) => {
    const b = i * 4;
    return px[b] >= 255 - tolerance && px[b+1] >= 255 - tolerance && px[b+2] >= 255 - tolerance;
  };
  const enqueue = (idx) => {
    if (idx >= 0 && idx < width * height && !visited[idx]) {
      visited[idx] = 1; queue[qTail++] = idx;
    }
  };

  // Seed all edge pixels
  for (let x = 0; x < width; x++) {
    enqueue(x); enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width); enqueue(y * width + width - 1);
  }

  // BFS flood fill inward
  while (qHead < qTail) {
    const idx = queue[qHead++];
    if (!isWhitish(idx)) continue;
    transparent[idx] = 1;
    const x = idx % width, y = Math.floor(idx / width);
    if (x > 0)       enqueue(idx - 1);
    if (x < width-1) enqueue(idx + 1);
    if (y > 0)       enqueue(idx - width);
    if (y < height-1) enqueue(idx + width);
  }

  // Second pass: feather semi-white edge pixels adjacent to transparent
  for (let i = 0; i < width * height; i++) {
    if (transparent[i]) { px[i * 4 + 3] = 0; continue; }
    const x = i % width, y = Math.floor(i / width);
    const adjTransparent =
      (x > 0       && transparent[i-1]) ||
      (x < width-1 && transparent[i+1]) ||
      (y > 0       && transparent[i-width]) ||
      (y < height-1 && transparent[i+width]);
    if (adjTransparent) {
      const b = i * 4;
      const whiteness = Math.min(px[b], px[b+1], px[b+2]);
      if (whiteness > 200) {
        px[b+3] = Math.round(Math.max(0, 1 - (whiteness - 200) / 55) * 255);
      }
    }
  }

  // Trim transparent border so icon fills its CSS container tightly
  return sharp(Buffer.from(px.buffer), { raw: { width, height, channels: 4 } })
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
}
