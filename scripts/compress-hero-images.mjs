import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Display cap is ~860px (finder) / ~580px (landing); keep 2x sources, never enlarge. */
const HEROES = [
  { src: "public/finder/finder-hero.png", dest: "public/finder/finder-hero.webp", maxWidth: 1520 },
  { src: "public/finder/clinics-hero.png", dest: "public/finder/clinics-hero.webp", maxWidth: 1320 },
  { src: "public/finder/avatars/clinic-hero.png", dest: "public/finder/avatars/clinic-hero.webp", maxWidth: 1024 },
  { src: "public/landing/hero-doctor.png", dest: "public/landing/hero-doctor.webp", maxWidth: 1200 },
];

for (const hero of HEROES) {
  const input = path.join(root, hero.src);
  const output = path.join(root, hero.dest);
  if (!existsSync(input)) {
    console.warn(`Skip ${hero.src} (missing PNG source)`);
    continue;
  }
  mkdirSync(path.dirname(output), { recursive: true });
  const image = sharp(input);
  const meta = await image.metadata();
  const width = meta.width ?? hero.maxWidth;
  const resized = width > hero.maxWidth ? image.resize({ width: hero.maxWidth, withoutEnlargement: true }) : image;
  await resized.webp({ quality: 78, effort: 6, alphaQuality: 80 }).toFile(output);
  const outMeta = await sharp(output).metadata();
  const inKb = Math.round(statSync(input).size / 1024);
  const outKb = Math.round(statSync(output).size / 1024);
  console.log(`${hero.dest} ${width}x${meta.height} -> ${outMeta.width}x${outMeta.height} ${inKb}KB PNG to ${outKb}KB WebP`);
}
