// Turns the raw Playwright recordings into MP4s: trims the login plumbing and re-encodes
// for YouTube / Instagram. Optional intro/outro cards (PNG) are held for a few seconds.
//
//   FFMPEG_PATH=... node scripts/tutorial-videos/compose.mjs <name> [--cards <dir>]
//   (--cards picks <dir>/<name>-intro-<cut>.png and <dir>/outro-<cut>.png, made by cards.mjs)
//
// Reads  <out>/raw/**/video.webm + <out>/<name>.<project>.json   (written by the spec)
// Writes <out>/<name>-tutorial.mp4, and <out>/<name>-reel.mp4 when the reel was recorded

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const name = process.argv[2];
if (!name) throw new Error("Usage: compose.mjs <name> [--cards <dir>]");
const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : null;
};
const outDir = process.env.TUTORIAL_VIDEOS_OUT ?? path.resolve("tutorial-videos-out");
const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
const CARD_SECONDS = 2.5;

function findRaw(project) {
  const rawDir = path.join(outDir, "raw");
  const dir = fs.readdirSync(rawDir).find((d) => d.includes(name) && d.includes(project));
  if (!dir) throw new Error(`No raw recording for ${name} / ${project} in ${rawDir}`);
  return path.join(rawDir, dir, "video.webm");
}

function run(args) {
  const r = spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
}

for (const [project, label, size] of [
  ["tutorial", "tutorial", "1280:720"],
  ["reel", "reel", "1080:1920"],
]) {
  const timing = path.join(outDir, `${name}.${project}.json`);
  if (!fs.existsSync(timing)) {
    console.log(`skipped the ${label} cut: nothing recorded for it (the reel needs TUTORIAL_REEL=1)`);
    continue;
  }
  const { startOffsetSec } = JSON.parse(fs.readFileSync(timing, "utf8"));
  const src = findRaw(project);
  const out = path.join(outDir, `${name}-${label}.mp4`);
  const cardsDir = arg("--cards");
  const cards = cardsDir
    ? [path.join(cardsDir, `${name}-intro-${label}.png`), path.join(cardsDir, `outro-${label}.png`)]
    : [null, null];

  const inputs = [];
  const filters = [];
  const labels = [];
  const vf = `scale=${size}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${size}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p,setsar=1`;
  let n = 0;
  if (cards[0]) {
    inputs.push("-loop", "1", "-t", String(CARD_SECONDS), "-i", cards[0]);
    filters.push(`[${n}:v]${vf}[v${n}]`);
    labels.push(`[v${n}]`);
    n++;
  }
  inputs.push("-ss", String(startOffsetSec), "-i", src);
  filters.push(`[${n}:v]${vf}[v${n}]`);
  labels.push(`[v${n}]`);
  n++;
  if (cards[1]) {
    inputs.push("-loop", "1", "-t", String(CARD_SECONDS), "-i", cards[1]);
    filters.push(`[${n}:v]${vf}[v${n}]`);
    labels.push(`[v${n}]`);
    n++;
  }
  filters.push(`${labels.join("")}concat=n=${labels.length}:v=1:a=0[out]`);
  run([...inputs, "-filter_complex", filters.join(";"), "-map", "[out]", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", out]);
  console.log(`wrote ${out}`);
}
