"use client";

import * as React from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer, QrCode } from "lucide-react";
import { getPublicBookingBaseUrl } from "@/lib/site-url";
import { resolvePromotePracticeCopy } from "@/lib/promote-practice-copy";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Props = {
  slug: string | null | undefined;
  doctorName: string;
  localeLike?: string | null;
  /** `modal`: flatter layout for the floating-action modal (no outer card). */
  variant?: "card" | "modal";
};

export function PromotePracticeSection({
  slug,
  doctorName,
  localeLike,
  variant = "card",
}: Props) {
  const copy = React.useMemo(
    () => resolvePromotePracticeCopy(localeLike),
    [localeLike]
  );
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const bookingUrl = slug
    ? `${getPublicBookingBaseUrl()}/${encodeURIComponent(slug)}`
    : "";

  const downloadPng = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !slug) return;
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `doccy-booking-qr-${slug.replace(/[^\w-]+/g, "_")}.png`;
    a.rel = "noopener";
    const supportsDownload = "download" in HTMLAnchorElement.prototype;
    if (!supportsDownload) {
      window.open(dataUrl, "_blank", "noopener,noreferrer");
      return;
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [slug]);

  const printBookingSign = React.useCallback(() => {
    if (!slug || !bookingUrl) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas?.toDataURL("image/png") ?? "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>DocCy · Booking sign</title>
<style>
  @page { size: A5 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    max-width: 148mm;
    min-height: 210mm;
    margin: 0 auto;
    padding: 10mm 12mm 14mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .logo {
    font-size: 2.25rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    margin-bottom: 2mm;
    color: #0f172a;
  }
  .logo span { color: #10b981; }
  .name {
    font-size: 0.9rem;
    font-weight: 600;
    color: #475569;
    margin-bottom: 5mm;
  }
  .qr img {
    display: block;
    width: 46mm;
    height: 46mm;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
  .cta {
    margin-top: 7mm;
    font-size: 1.2rem;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.35;
    max-width: 118mm;
  }
  .url {
    margin-top: 5mm;
    font-size: 0.62rem;
    color: #64748b;
    word-break: break-all;
    max-width: 130mm;
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="logo">Doc<span>Cy</span></div>
    <p class="name">${escapeHtml(doctorName)}</p>
    <div class="qr"><img src="${dataUrl}" alt="" width="512" height="512" /></div>
    <p class="cta">${escapeHtml(copy.printCta)}</p>
    <p class="url">${escapeHtml(bookingUrl)}</p>
  </div>
</body>
</html>`;

    // Avoid window.open(): pop-up blockers return null and the print flow breaks.
    // Printing from a same-origin hidden iframe works without extra permissions.
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "DocCy booking sign");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "148mm",
      height: "210mm",
      border: "0",
      opacity: "0",
      pointerEvents: "none",
      zIndex: "-1",
    });
    document.body.appendChild(iframe);

    const idoc = iframe.contentDocument;
    const iwin = iframe.contentWindow;
    if (!idoc || !iwin) {
      iframe.remove();
      window.alert(copy.printPrepareFailed);
      return;
    }

    idoc.open();
    idoc.write(html);
    idoc.close();

    let fallbackRemove: number | undefined;
    const cleanup = () => {
      if (fallbackRemove !== undefined) window.clearTimeout(fallbackRemove);
      iframe.remove();
    };

    const triggerPrint = () => {
      try {
        iwin.focus();
        iwin.print();
      } catch {
        cleanup();
        window.alert(copy.printDialogFailed);
        return;
      }
      iwin.addEventListener("afterprint", cleanup, { once: true });
      fallbackRemove = window.setTimeout(cleanup, 120_000);
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(triggerPrint, 150);
      });
    });
  }, [slug, bookingUrl, doctorName, copy.printCta, copy.printPrepareFailed, copy.printDialogFailed]);

  const shell = (className: string, children: React.ReactNode) =>
    variant === "modal" ? (
      <div className={className}>{children}</div>
    ) : (
      <section className={className}>{children}</section>
    );

  const outerMuted =
    variant === "modal"
      ? "space-y-4"
      : "rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5";

  if (!slug?.trim()) {
    return shell(
      outerMuted,
      <>
        <div className="flex items-center gap-2 text-amber-200/90">
          <QrCode className="h-5 w-5 shrink-0" aria-hidden />
          <h2 className="text-sm font-semibold text-slate-100">{copy.missingSlugTitle}</h2>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {copy.missingSlugBody}
        </p>
      </>
    );
  }

  return shell(
    outerMuted,
    <>
      {variant === "card" && (
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
            <QrCode className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{copy.title}</h2>
            <p className="text-xs text-slate-500">{copy.subtitle}</p>
          </div>
        </div>
      )}

      <p className={`text-xs text-slate-500 ${variant === "card" ? "mt-4" : ""}`}>
        {copy.patientsScanPrefix}{" "}
        <span className="break-all font-mono text-slate-400">{bookingUrl}</span>
      </p>

      <div
        className={`flex flex-col items-center gap-4 rounded-xl border border-slate-800/60 bg-white p-6 sm:flex-row sm:items-start sm:justify-center ${
          variant === "card" ? "mt-4" : "mt-3"
        }`}
      >
        <div className="rounded-lg bg-white p-2 shadow-inner ring-1 ring-slate-200/80">
          <QRCodeCanvas
            ref={canvasRef}
            value={bookingUrl}
            size={280}
            level="H"
            includeMargin
            bgColor="#ffffff"
            fgColor="#0f172a"
          />
        </div>
        <div className="flex w-full max-w-xs flex-col gap-3 sm:pt-1">
          <button
            type="button"
            onClick={printBookingSign}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
          >
            <Printer className="h-4 w-4" aria-hidden />
            {copy.printButton}
          </button>
          <button
            type="button"
            onClick={downloadPng}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
          >
            <Download className="h-4 w-4" aria-hidden />
            {copy.downloadButton}
          </button>
          <p className="text-[11px] leading-relaxed text-slate-500">{copy.printHelper}</p>
        </div>
      </div>
    </>
  );
}
