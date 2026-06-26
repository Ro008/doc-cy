"use client";

import * as React from "react";
import { ChevronDown, Copy, LifeBuoy } from "lucide-react";
import {
  DOCCY_FEEDBACK_SUBJECT_WEBSITE_BOOKING,
  emitOpenFeedback,
} from "@/lib/doccy-feedback";
import type { PromotePracticeCopy } from "@/lib/promote-practice-copy";
import {
  buildReceptionScriptText,
  buildVoicemailScriptText,
  buildWebsiteButtonHtml,
  buildWebsiteSupportPrefill,
} from "@/lib/promote-practice-script-templates";

type ScriptBlockProps = {
  title: string;
  hint: string;
  value: string;
  onChange?: (value: string) => void;
  copy: PromotePracticeCopy;
  testId: string;
  rows?: number;
};

function ScriptBlock({
  title,
  hint,
  value,
  onChange,
  copy,
  testId,
  rows = 5,
}: ScriptBlockProps) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert(copy.copyFailed);
    }
  }

  return (
    <div
      className="rounded-xl border border-slate-800/70 bg-ink-900/40 p-4"
      data-testid={testId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/60 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-clinical-400/40 hover:bg-clinical-500/10 hover:text-clinical-100"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {copied ? copy.copiedButton : copy.copyButton}
        </button>
      </div>
      <textarea
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={!onChange}
        rows={rows}
        className="mt-3 w-full resize-y rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm leading-relaxed text-slate-200 focus:outline-none focus:ring-2 focus:ring-clinical-500/30"
      />
    </div>
  );
}

function CopyBriefButton({ text, copy }: { text: string; copy: PromotePracticeCopy }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert(copy.copyFailed);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/60 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-clinical-400/40 hover:bg-clinical-500/10 hover:text-clinical-100"
    >
      <Copy className="h-3.5 w-3.5" aria-hidden />
      {copied ? copy.copiedButton : copy.copyButton}
    </button>
  );
}

type PromotePracticeScriptsProps = {
  slug: string;
  doctorName: string;
  bookingUrl: string;
  localeLike?: string | null;
  copy: PromotePracticeCopy;
};

export function PromotePracticeScripts({
  slug,
  doctorName,
  bookingUrl,
  localeLike,
  copy,
}: PromotePracticeScriptsProps) {
  const [voicemailText, setVoicemailText] = React.useState(() =>
    buildVoicemailScriptText(localeLike, bookingUrl)
  );
  const [receptionText, setReceptionText] = React.useState(() =>
    buildReceptionScriptText(localeLike, bookingUrl)
  );

  React.useEffect(() => {
    setVoicemailText(buildVoicemailScriptText(localeLike, bookingUrl));
    setReceptionText(buildReceptionScriptText(localeLike, bookingUrl));
  }, [localeLike, bookingUrl, slug]);

  const websiteBriefForWebPerson = React.useMemo(() => {
    const isEl =
      String(localeLike ?? "")
        .toLowerCase()
        .startsWith("el") ||
      String(localeLike ?? "")
        .toLowerCase()
        .startsWith("gr");
    const buttonText = isEl ? "Κράτηση online" : "Book appointment online";
    const linkLabel = isEl ? "Σύνδεσμος" : "Link";
    return `${copy.websiteButtonLabel}: ${buttonText}\n${linkLabel}: ${bookingUrl}`;
  }, [localeLike, bookingUrl, copy.websiteButtonLabel]);

  const websiteHtml = React.useMemo(
    () => buildWebsiteButtonHtml(bookingUrl, localeLike),
    [bookingUrl, localeLike]
  );

  function openWebsiteSupport() {
    emitOpenFeedback({
      subject: DOCCY_FEEDBACK_SUBJECT_WEBSITE_BOOKING,
      message: buildWebsiteSupportPrefill(localeLike, doctorName, bookingUrl),
    });
  }

  return (
    <div className="mt-8 space-y-4 border-t border-slate-800/80 pt-8">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-clinical-200/90">
        {copy.scriptsSectionTitle}
      </h3>

      <ScriptBlock
        testId="promote-voicemail-script"
        title={copy.voicemailTitle}
        hint={copy.voicemailHint}
        value={voicemailText}
        onChange={setVoicemailText}
        copy={copy}
        rows={4}
      />

      <ScriptBlock
        testId="promote-reception-script"
        title={copy.receptionTitle}
        hint={copy.receptionHint}
        value={receptionText}
        onChange={setReceptionText}
        copy={copy}
        rows={4}
      />

      <div
        className="rounded-xl border border-slate-800/70 bg-ink-900/40 p-4"
        data-testid="promote-website-script"
      >
        <h3 className="text-sm font-semibold text-slate-100">{copy.websiteTitle}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{copy.websiteHint}</p>

        <p className="mt-3 text-xs font-medium text-slate-400">{copy.websiteSendToWebPerson}</p>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/80 p-3 font-mono text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
          {websiteBriefForWebPerson}
        </pre>
        <div className="mt-2">
          <CopyBriefButton text={websiteBriefForWebPerson} copy={copy} />
        </div>

        <div className="mt-4 rounded-lg border border-slate-800/60 bg-slate-900/50 p-3">
          <p className="text-sm font-medium text-slate-200">{copy.websiteFreeHelp}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{copy.websiteFreeHelpNote}</p>
          <button
            type="button"
            onClick={openWebsiteSupport}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-clinical-400/35 bg-clinical-500/10 px-3 py-2 text-xs font-semibold text-clinical-100 transition hover:bg-clinical-500/20"
          >
            <LifeBuoy className="h-4 w-4" aria-hidden />
            {copy.websiteContactSupport}
          </button>
        </div>

        <details className="mt-4 group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-slate-400 marker:content-none [&::-webkit-details-marker]:hidden">
            <ChevronDown
              className="h-4 w-4 transition group-open:rotate-180"
              aria-hidden
            />
            {copy.websiteHtmlToggle}
          </summary>
          <p className="mt-2 text-[11px] text-slate-500">{copy.websiteHtmlHint}</p>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/80 p-3 font-mono text-[11px] leading-relaxed text-slate-400 whitespace-pre-wrap break-all">
            {websiteHtml}
          </pre>
          <div className="mt-2">
            <CopyBriefButton text={websiteHtml} copy={copy} />
          </div>
        </details>
      </div>
    </div>
  );
}
