// Turns the recordings of record-gifs.spec.ts into the GIFs the email shows (public/email/*.gif):
// cuts the login, then 10 fps at 640 px wide (shown at 516 in the email, so text stays readable on a
// sharp screen) with one palette per animation, which keeps flat UI colours clean and the file small.
//
//   FFMPEG_PATH=<ffmpeg> ANNOUNCEMENT_OUT=<dir> node scripts/announcement-email/make-gifs.mjs [name...]
//
// Reads <out>/raw/**/video.webm and <out>/<name>.json. Writes public/email/<name>.gif.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const outDir = process.env.ANNOUNCEMENT_OUT ?? path.resolve("announcement-out");
const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
const publicDir = path.resolve("public", "email");
const names = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["dashboard", "agenda", "settings"];

fs.mkdirSync(publicDir, { recursive: true });

for (const name of names) {
  const rawDir = path.join(outDir, "raw");
  const dir = fs.readdirSync(rawDir).find((d) => d.startsWith("record-gifs-" + name));
  if (!dir) throw new Error(`No recording for "${name}" in ${rawDir}`);
  const { startOffsetSec } = JSON.parse(fs.readFileSync(path.join(outDir, `${name}.json`), "utf8"));
  const out = path.join(publicDir, `${name}.gif`);
  const filter =
    "fps=10,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle";
  const r = spawnSync(
    ffmpeg,
    ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(startOffsetSec), "-i", path.join(rawDir, dir, "video.webm"), "-vf", filter, "-loop", "0", out],
    { stdio: "inherit" },
  );
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${name}`);
  console.log(`${name}.gif: ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}
