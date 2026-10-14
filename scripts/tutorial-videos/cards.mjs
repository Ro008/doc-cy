// Renders the intro / outro cards (PNG) for a video in both formats, with the DocCy logo and
// palette. Swap them for Canva designs any time: compose.mjs only needs the PNG files.
//
//   node scripts/tutorial-videos/cards.mjs <name> "<Title>" "<subtitle>" [--emoji 🩺]
//
// Writes <out>/cards/<name>-intro-tutorial.png and outro-tutorial.png (and the -reel ones with --reel)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const [name, title, subtitle] = process.argv.slice(2);
if (!name || !title) throw new Error('Usage: cards.mjs <name> "<Title>" "<subtitle>" [--emoji 🩺]');
const emojiIdx = process.argv.indexOf("--emoji");
const emoji = emojiIdx > 0 ? process.argv[emojiIdx + 1] : "🩺";
const outDir = path.join(process.env.TUTORIAL_VIDEOS_OUT ?? path.resolve("tutorial-videos-out"), "cards");
fs.mkdirSync(outDir, { recursive: true });

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Inlined: a page set with setContent() cannot load file:// images.
const logo = `data:image/png;base64,${fs.readFileSync(path.join(repoRoot, "public/brand/doccy-logo-on-dark.png")).toString("base64")}`;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const html = (kind, reel) => `<!doctype html><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:100vw;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${reel ? 56 : 34}px;
    background:radial-gradient(circle at 30% 20%,#0d4a8a 0%,#062f61 55%,#04203f 100%);color:#fff;text-align:center;
    font-family:"Segoe UI","Segoe UI Emoji",system-ui,sans-serif;padding:${reel ? "0 90px" : "0 120px"};position:relative;overflow:hidden}
  body::before{content:"";position:absolute;width:${reel ? 900 : 700}px;height:${reel ? 900 : 700}px;border-radius:50%;right:-${reel ? 300 : 200}px;bottom:-${reel ? 300 : 260}px;
    background:radial-gradient(circle,rgba(18,184,192,.45),transparent 65%)}
  img{width:${reel ? 560 : 420}px;position:relative}
  .tag{font-weight:700;letter-spacing:.18em;text-transform:uppercase;font-size:${reel ? 34 : 22}px;color:#7dd9df;position:relative}
  h1{font-weight:800;font-size:${reel ? 118 : 84}px;line-height:1.08;letter-spacing:-.02em;position:relative;text-wrap:balance}
  .emoji{font-size:${reel ? 150 : 100}px;position:relative}
  p{font-size:${reel ? 46 : 32}px;color:#b8ebef;position:relative;line-height:1.3}
  .url{display:inline-block;margin-top:8px;padding:${reel ? "20px 48px" : "14px 34px"};border-radius:999px;background:#12b8c0;color:#04203f;font-weight:800;font-size:${reel ? 52 : 34}px;position:relative}
</style>${
  kind === "intro"
    ? `<img src="${logo}">${reel ? `<div class="emoji">${esc(emoji)}</div>` : ""}<div class="tag">How-to</div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}`
    : `<img src="${logo}"><h1>${reel ? "More how-tos<br>coming soon" : "More how-tos coming soon"}</h1><p>Made for healthcare professionals in Cyprus</p><div class="url">mydoccy.com</div>`
}`;

const browser = await chromium.launch();
// The vertical cut (Instagram) is paused: pass --reel to make its cards too.
const formats = [["tutorial", 1280, 720, false], ...(process.argv.includes("--reel") ? [["reel", 1080, 1920, true]] : [])];
for (const [label, w, h, reel] of formats) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  for (const kind of ["intro", "outro"]) {
    await page.setContent(html(kind, reel));
    await page.waitForLoadState("load");
    await page.waitForTimeout(200);
    const file = path.join(outDir, kind === "intro" ? `${name}-intro-${label}.png` : `outro-${label}.png`);
    await page.screenshot({ path: file });
    console.log(`wrote ${file}`);
  }
}
await browser.close();
