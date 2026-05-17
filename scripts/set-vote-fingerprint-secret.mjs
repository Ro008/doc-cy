/**
 * Adds or updates DOC_CY_VOTE_FINGERPRINT_SECRET in a gitignored env file.
 * Usage: node scripts/set-vote-fingerprint-secret.mjs [.env.testing.local]
 *        node scripts/set-vote-fingerprint-secret.mjs .env.production.local
 * Does not print the secret. Safe to run multiple times (regenerates when replacing).
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const rel = process.argv[2] || ".env.testing.local";
const envPath = join(root, rel);
const key = "DOC_CY_VOTE_FINGERPRINT_SECRET";
const value = randomBytes(32).toString("hex");

let text = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const lineRe = new RegExp(`^${key}=.*$`, "m");
if (lineRe.test(text)) {
  text = text.replace(lineRe, `${key}=${value}`);
} else {
  const block = `\n# Finder vote anti-spam (server-only).\n${key}=${value}\n`;
  text = text.trimEnd() ? `${text.trimEnd()}${block}` : `# ${rel} — merge other keys from .env.example / Vercel as needed.${block}`;
}
writeFileSync(envPath, text, "utf8");
console.log(`Updated ${envPath} with ${key} (value not shown).`);
if (rel.includes("production")) {
  console.log(
    "Copy DOC_CY_VOTE_FINGERPRINT_SECRET into Vercel → Project → Settings → Environment Variables → Production (same value), then redeploy.",
  );
} else {
  console.log("Restart npm run dev if it is running.");
}
