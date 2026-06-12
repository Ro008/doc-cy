import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const sourcePath = path.join(__dirname, ".finder-hero-original.png");
const outputPath = path.join(root, "public", "finder", "finder-hero.png");

const left = 0;
const top = 0;
const width = 255;
const height = 96;

const patch = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="80%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="#ffffff" />
  <rect width="100%" height="100%" fill="url(#edge)" />
</svg>`);

await sharp(sourcePath)
  .composite([{ input: patch, left, top }])
  .png()
  .toFile(outputPath);

console.log("Removed DocCy logo from public/finder/finder-hero.png");
