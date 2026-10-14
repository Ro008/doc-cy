// Writes the "what's new" email as an HTML file you can open in a browser, to look at it before
// sending. Animations load from `--base` (default: this checkout's public/ folder, so it works
// before they are deployed).
//
//   npx tsx scripts/announcement-email/preview.ts [--name Elena] [--base https://www.mydoccy.com] [--out preview.html]

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { buildProductAnnouncementEmailContent } from "../../lib/product-announcement-email";

const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const base = arg("--base") ?? pathToFileURL(path.resolve("public")).href.replace(/^file:\/\/\//, "file:///");
const out = path.resolve(arg("--out") ?? path.join("announcement-out", "preview.html"));
const { subject, html } = buildProductAnnouncementEmailContent({ siteUrl: base, firstName: arg("--name") ?? "Elena" });

fs.mkdirSync(path.dirname(out), { recursive: true });
// `public/` is the site root, so /email/x.gif resolves to public/email/x.gif.
fs.writeFileSync(
  out,
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head><body style="margin:0;background:#062F61;">${html}</body></html>`,
);
console.log(`Subject: ${subject}\nWrote ${out}`);
