"use client";

import * as React from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import type { PromotePracticeCopy } from "@/lib/promote-practice-copy";
import {
  buildReceptionScriptText,
  buildVoicemailScriptText,
  buildWebsiteButtonHtml,
  parsePromoteLanguage,
  websiteButtonLabel,
} from "@/lib/promote-practice-script-templates";
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_EYEBROW_CLASS,
  SETTINGS_SMALL_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/settings/styles";

const COPY_BUTTON_CLASS = SETTINGS_SMALL_SECONDARY_BUTTON_CLASS;

function CopyButton({ text, copy }: { text: string; copy: PromotePracticeCopy }) {
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
    <button type="button" onClick={handleCopy} className={COPY_BUTTON_CLASS}>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-clinical-300" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
      {copied ? copy.copiedButton : copy.copyButton}
    </button>
  );
}

/**
 * One script as a row that opens on click (user, 2026-10-01): the three scripts were a
 * long wall of text; now only the one being used is open.
 */
function ScriptRow({
  title,
  hint,
  testId,
  children,
}: {
  title: string;
  hint: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group py-1" data-testid={testId}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-1 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-100">{title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{hint}</span>
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="px-1 pb-3">{children}</div>
    </details>
  );
}

function ScriptText({
  value,
  onChange,
  copy,
  rows = 4,
}: {
  value: string;
  onChange: (value: string) => void;
  copy: PromotePracticeCopy;
  rows?: number;
}) {
  return (
    <>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full resize-y rounded-xl border border-pro-line bg-pro-page/60 px-3 py-2 text-sm leading-relaxed text-slate-200 focus:outline-none focus:ring-2 focus:ring-clinical-400/30"
      />
      <div className="mt-2">
        <CopyButton text={value} copy={copy} />
      </div>
    </>
  );
}

type PromotePracticeScriptsProps = {
  doctorName: string;
  bookingUrl: string;
  /** The site as she would say it, e.g. "mydoccy.com". */
  siteHost: string;
  /** The language she picked for the sign and scripts. */
  localeLike?: string | null;
  copy: PromotePracticeCopy;
};

export function PromotePracticeScripts({
  doctorName,
  bookingUrl,
  siteHost,
  localeLike,
  copy,
}: PromotePracticeScriptsProps) {
  const voicemailDefault = buildVoicemailScriptText(localeLike, { name: doctorName, siteHost });
  const receptionDefault = buildReceptionScriptText(localeLike, { name: doctorName, bookingUrl });
  const [voicemailText, setVoicemailText] = React.useState(voicemailDefault);
  const [receptionText, setReceptionText] = React.useState(receptionDefault);

  // A new language (or link) starts from the ready-made wording again.
  React.useEffect(() => {
    setVoicemailText(voicemailDefault);
    setReceptionText(receptionDefault);
  }, [voicemailDefault, receptionDefault]);

  const websiteBriefForWebPerson = React.useMemo(() => {
    const linkLabel = parsePromoteLanguage(localeLike) === "el" ? "Σύνδεσμος" : "Link";
    return `${copy.websiteButtonLabel}: ${websiteButtonLabel(localeLike)}\n${linkLabel}: ${bookingUrl}`;
  }, [localeLike, bookingUrl, copy.websiteButtonLabel]);

  const websiteHtml = React.useMemo(
    () => buildWebsiteButtonHtml(bookingUrl, localeLike),
    [bookingUrl, localeLike]
  );

  return (
    <section className={SETTINGS_CARD_CLASS}>
      <h2 className={SETTINGS_EYEBROW_CLASS}>{copy.scriptsSectionTitle}</h2>
      <div className="mt-2 divide-y divide-pro-line">
        <ScriptRow testId="promote-voicemail-script" title={copy.voicemailTitle} hint={copy.voicemailHint}>
          <ScriptText value={voicemailText} onChange={setVoicemailText} copy={copy} />
        </ScriptRow>

        <ScriptRow testId="promote-reception-script" title={copy.receptionTitle} hint={copy.receptionHint}>
          <ScriptText value={receptionText} onChange={setReceptionText} copy={copy} />
        </ScriptRow>

        <ScriptRow testId="promote-website-script" title={copy.websiteTitle} hint={copy.websiteHint}>
          <p className="text-xs font-medium text-slate-400">{copy.websiteSendToWebPerson}</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl border border-pro-line bg-pro-page/60 p-3 font-mono text-xs leading-relaxed text-slate-300">
            {websiteBriefForWebPerson}
          </pre>
          <div className="mt-2">
            <CopyButton text={websiteBriefForWebPerson} copy={copy} />
          </div>

          <details className="group/html mt-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-slate-400 marker:content-none [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-4 w-4 transition group-open/html:rotate-180" aria-hidden />
              {copy.websiteHtmlToggle}
            </summary>
            <p className="mt-2 text-[11px] text-slate-500">{copy.websiteHtmlHint}</p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-pro-line bg-pro-page/60 p-3 font-mono text-[11px] leading-relaxed text-slate-400">
              {websiteHtml}
            </pre>
            <div className="mt-2">
              <CopyButton text={websiteHtml} copy={copy} />
            </div>
          </details>
        </ScriptRow>
      </div>
    </section>
  );
}
