"use client";

import * as React from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Check, Copy, Download, MessageCircle, Printer, QrCode } from "lucide-react";
import { resolvePromotePracticeCopy } from "@/lib/promote-practice-copy";
import {
  buildPublicProfileUrl,
  buildShareMessage,
  buildViberShareUrl,
  buildWhatsAppShareUrl,
  parsePromoteLanguage,
  type PromoteLanguage,
} from "@/lib/promote-practice-script-templates";
import { getPublicBookingBaseUrl } from "@/lib/site-url";
import { PromotePracticeScripts } from "@/components/dashboard/PromotePracticeScripts";
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_EYEBROW_CLASS,
  SETTINGS_SECONDARY_BUTTON_CLASS,
  SETTINGS_SMALL_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/settings/styles";
import { shortBookingLink } from "@/lib/settings-account";
import { buildBookingSignHtml } from "@/lib/booking-sign";

type Props = {
  slug: string | null | undefined;
  doctorName: string;
  /** The profile's approved specialty, printed under the name on the sign. */
  specialty?: string | null;
  localeLike?: string | null;
};

/** Remembered in this browser only: a convenience, nothing depends on it. */
const LANGUAGE_STORAGE_KEY = "doccy:promote-language";
const LANGUAGES: { id: PromoteLanguage; label: string }[] = [
  { id: "en", label: "English" },
  { id: "el", label: "Ελληνικά" },
];

/** Waits for the sign's logo, QR and font, so the print never comes out half drawn. */
function whenSignReady(doc: Document, maxMs = 3000): Promise<void> {
  const images = Array.from(doc.images).map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
  );
  const fonts = doc.fonts?.ready.then(() => undefined) ?? Promise.resolve();
  const cap = new Promise<void>((resolve) => window.setTimeout(resolve, maxMs));
  return Promise.race([Promise.all([...images, fonts]).then(() => undefined), cap]);
}

export function PromotePracticeSection({
  slug,
  doctorName,
  specialty,
  localeLike,
}: Props) {
  const copy = React.useMemo(
    () => resolvePromotePracticeCopy(localeLike),
    [localeLike]
  );
  // The sign and the scripts are for her patients, so she picks their language
  // (user, 2026-10-11); the tab itself stays in the app's language.
  const [language, setLanguage] = React.useState<PromoteLanguage>(() => parsePromoteLanguage(localeLike));
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved) setLanguage(parsePromoteLanguage(saved));
    } catch {
      // Storage can be blocked; the choice then lasts for this visit.
    }
  }, []);
  function chooseLanguage(next: PromoteLanguage) {
    setLanguage(next);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // See above.
    }
  }
  const signCopy = React.useMemo(() => resolvePromotePracticeCopy(language), [language]);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const profileBookingUrl = slug ? buildPublicProfileUrl(slug) : "";
  const bookingUrl = slug
    ? `${profileBookingUrl}?utm_source=doctor_qr&utm_medium=profile_card&ref=doctor_profile_qr`
    : "";

  const shareMessage = buildShareMessage(language, doctorName, profileBookingUrl);
  const [linkCopied, setLinkCopied] = React.useState(false);
  // The plain profile link (no QR tracking), for websites, emails and messages.
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(profileBookingUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.alert(copy.copyFailed);
    }
  }
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

    const html = buildBookingSignHtml({
      doctorName,
      specialty: specialty ?? "",
      qrDataUrl: dataUrl,
      logoUrl: `${window.location.origin}/brand/doccy-logo.png`,
      shortLink: shortBookingLink(profileBookingUrl),
      copy: signCopy,
    });

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

    void whenSignReady(idoc).then(() => {
      requestAnimationFrame(() => {
        window.setTimeout(triggerPrint, 50);
      });
    });
  }, [slug, bookingUrl, profileBookingUrl, doctorName, specialty, copy, signCopy]);

  if (!slug?.trim()) {
    return (
      <section className={SETTINGS_CARD_CLASS}>
        <div className="flex items-center gap-2 text-amber-200/90">
          <QrCode className="h-5 w-5 shrink-0" aria-hidden />
          <h2 className="text-sm font-semibold text-slate-100">{copy.missingSlugTitle}</h2>
        </div>
        <p className="mt-2 text-sm text-slate-400">{copy.missingSlugBody}</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div
        role="group"
        aria-label={copy.languageLabel}
        data-testid="promote-language"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <p className="text-sm text-slate-300">{copy.languageLabel}</p>
        <div className="inline-flex rounded-xl border border-slate-700 bg-slate-950/40 p-1">
          {LANGUAGES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={language === option.id}
              onClick={() => chooseLanguage(option.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                language === option.id
                  ? "bg-clinical-500 text-slate-950"
                  : "text-slate-300 hover:text-slate-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <section className={SETTINGS_CARD_CLASS} data-testid="promote-booking-link">
        <h2 className={SETTINGS_EYEBROW_CLASS}>{copy.bookingLinkLabel}</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 truncate font-mono text-sm text-slate-100" title={profileBookingUrl}>
            {shortBookingLink(profileBookingUrl)}
          </p>
          <button type="button" onClick={() => void copyLink()} className={SETTINGS_SECONDARY_BUTTON_CLASS}>
            {linkCopied ? (
              <Check className="h-4 w-4 text-clinical-300" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
            {linkCopied ? copy.copiedButton : copy.copyLinkButton}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="promote-share">
          <span className="text-xs text-slate-400">{copy.shareLabel}</span>
          <a
            href={buildWhatsAppShareUrl(shareMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className={SETTINGS_SMALL_SECONDARY_BUTTON_CLASS}
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            WhatsApp
          </a>
          <a href={buildViberShareUrl(shareMessage)} className={SETTINGS_SMALL_SECONDARY_BUTTON_CLASS}>
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            Viber
          </a>
        </div>

        <div className="mt-5 flex flex-col items-center gap-5 rounded-2xl bg-white p-5 sm:flex-row sm:items-center">
          <QRCodeCanvas
            ref={canvasRef}
            value={bookingUrl}
            // Drawn large so the PNG and the printed sign stay sharp; shown smaller.
            size={512}
            style={{ width: 168, height: 168 }}
            level="H"
            includeMargin
            bgColor="#ffffff"
            fgColor="#062F61"
            className="shrink-0 rounded-lg ring-1 ring-slate-200"
          />
          <div className="flex w-full flex-col gap-3 sm:max-w-xs">
            <p className="text-sm font-medium text-slate-700">{copy.patientsScanCaption}</p>
            <button
              type="button"
              onClick={printBookingSign}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-clinical-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-clinical-400"
            >
              <Printer className="h-4 w-4" aria-hidden />
              {copy.printButton}
            </button>
            <button
              type="button"
              onClick={downloadPng}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              {copy.downloadButton}
            </button>
            <p className="text-xs text-slate-500">{copy.printHelper}</p>
          </div>
        </div>
      </section>

      {profileBookingUrl && slug ? (
        <PromotePracticeScripts
          doctorName={doctorName}
          bookingUrl={profileBookingUrl}
          siteHost={shortBookingLink(getPublicBookingBaseUrl())}
          localeLike={language}
          copy={copy}
        />
      ) : null}
    </div>
  );
}
