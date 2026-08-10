import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** DocCy token ink-50 — public page background */
const BG = { r: 0xf7, g: 0xfa, b: 0xfc };

function isBackgroundPixel(r, g, b, a) {
  if (a < 8) return true;
  return r >= 250 && g >= 250 && b >= 250;
}

function floodFillBackground(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  const pushIfBg = (x, y) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (!isBackgroundPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }

  while (queue.length > 0) {
    const idx = queue.pop();
    const i = idx * 4;
    data[i] = BG.r;
    data[i + 1] = BG.g;
    data[i + 2] = BG.b;
    data[i + 3] = 255;

    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) pushIfBg(x - 1, y);
    if (x < width - 1) pushIfBg(x + 1, y);
    if (y > 0) pushIfBg(x, y - 1);
    if (y < height - 1) pushIfBg(x, y + 1);
  }
}

const targets = process.argv.slice(2);
const relativePaths =
  targets.length > 0 ? targets : ["public/finder/finder-hero.png"];

for (const relative of relativePaths) {
  const imagePath = path.isAbsolute(relative)
    ? relative
    : path.join(root, relative);

  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  floodFillBackground(data, info.width, info.height);

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(imagePath);

  console.log(`Tinted background to ink-50 (#F7FAFC): ${imagePath}`);
}
