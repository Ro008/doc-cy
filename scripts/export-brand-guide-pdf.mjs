/**
 * Renders docs/brand/doccy-brand-guide.html to a print-ready PDF (A4, backgrounds on).
 *
 * Usage: npm run brand:guide:pdf
 * Output: docs/brand/DocCy-Brand-Guide.pdf
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "docs", "brand", "doccy-brand-guide.html");
const pdfPath = path.join(root, "docs", "brand", "DocCy-Brand-Guide.pdf");
const htmlUrl = `file:///${htmlPath.replace(/\\/g, "/")}`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(htmlUrl, { waitUntil: "networkidle" });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
    preferCSSPageSize: true,
  });
  console.log(`[DocCy] Brand guide PDF written to:\n  ${pdfPath}`);
} finally {
  await browser.close();
}
