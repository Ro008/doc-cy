import type { PromotePracticeCopy } from "@/lib/promote-practice-copy";

/**
 * The printed booking sign, design A "Clean & calm" (user, 2026-10-01; canvas
 * "DocCy booking sign"): the DocCy logo and a "Book online · 24/7" badge, one
 * headline, the name and specialty as on the profile (no "Dr" added: not every
 * professional is a doctor), the QR in a teal frame, three steps and the short link.
 * One A5 page, sized in mm so it prints the same on any printer.
 */

export type BookingSignInput = {
  doctorName: string;
  /** The profile's approved specialty; empty shows the name alone. */
  specialty: string;
  qrDataUrl: string;
  /** Absolute URL: the sign is printed from an iframe. */
  logoUrl: string;
  /** e.g. mydoccy.com/harrison-ford */
  shortLink: string;
  copy: PromotePracticeCopy;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CALENDAR_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#12B8C0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="3"></rect><path d="M16 2v4M8 2v4M3 10h18"></path><path d="m9 16 2 2 4-4"></path></svg>';

export function buildBookingSignHtml(input: BookingSignInput): string {
  const { copy } = input;
  const name = input.doctorName.trim();
  const specialty = input.specialty.trim();
  const who = specialty ? `${escapeHtml(name)} · ${escapeHtml(specialty)}` : escapeHtml(name);
  const steps = [copy.signStepScan, copy.signStepPick, copy.signStepConfirm]
    .map(
      (label, index) =>
        `<div class="step"><span class="num">${index + 1}</span><span>${escapeHtml(label)}</span></div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="${escapeHtml(copy.htmlLang)}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>DocCy · Booking sign</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  @page { size: A5 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #fff; }
  body {
    font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #062F61;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    width: 148mm;
    height: 210mm;
    padding: 13mm 13mm 11mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
  }
  .top { align-self: stretch; display: flex; align-items: center; justify-content: space-between; }
  .logo { display: block; height: 10.5mm; width: auto; }
  .badge {
    display: inline-flex; align-items: center; gap: 1.8mm;
    padding: 2.1mm 3.7mm; border-radius: 999px;
    background: #062F61; color: #fff; font-size: 9.5pt; font-weight: 700;
  }
  h1 {
    margin: 15mm 0 0; font-size: 28pt; line-height: 1.08; font-weight: 800;
    letter-spacing: -0.03em; text-align: center; text-wrap: balance;
  }
  .who { margin: 3.7mm 0 0; font-size: 12pt; line-height: 1.45; color: #33485C; text-align: center; }
  .qr-frame { margin-top: 9.5mm; padding: 4.2mm; border-radius: 7.4mm; border: 0.8mm solid #12B8C0; }
  .qr { display: block; width: 61mm; height: 61mm; image-rendering: pixelated; }
  .steps {
    margin-top: 8.5mm; align-self: stretch;
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3mm;
  }
  .step { display: flex; flex-direction: column; align-items: center; gap: 1.6mm; text-align: center; font-size: 9.5pt; font-weight: 600; }
  .num {
    width: 8mm; height: 8mm; border-radius: 999px; background: #E6F8F9; color: #0A6B72;
    font-size: 10.5pt; font-weight: 800; display: flex; align-items: center; justify-content: center;
  }
  .foot {
    margin-top: auto; align-self: stretch; padding-top: 4.8mm; border-top: 0.3mm solid #DDE7ED;
    display: flex; justify-content: space-between; align-items: baseline;
  }
  .link { font-size: 11pt; font-weight: 700; }
  .note { font-size: 9pt; color: #4A5F73; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <img class="logo" src="${escapeHtml(input.logoUrl)}" alt="my doccy"/>
      <span class="badge">${CALENDAR_ICON}<span>${escapeHtml(copy.signBadge)}</span></span>
    </div>
    <h1>${escapeHtml(copy.signHeadline)}</h1>
    <p class="who">${who}</p>
    <div class="qr-frame"><img class="qr" src="${escapeHtml(input.qrDataUrl)}" alt=""/></div>
    <div class="steps">${steps}</div>
    <div class="foot">
      <span class="link">${escapeHtml(input.shortLink)}</span>
      <span class="note">${escapeHtml(copy.signNoApp)}</span>
    </div>
  </div>
</body>
</html>`;
}
