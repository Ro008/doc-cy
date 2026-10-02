"use client";

import * as React from "react";
import { Check, Share2 } from "lucide-react";

type Props = {
  url: string;
  title: string;
  labels: { share: string; copied: string };
};

/**
 * Share the profile: the system share sheet where there is one (phones), otherwise
 * copy the link. Doctors use this page as their website, so it gets shared.
 */
export function ProfileShareButton({ url, title, labels }: Props) {
  const [copied, setCopied] = React.useState(false);

  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Closing the sheet is not an error; anything else falls back to copying.
        if ((error as { name?: string })?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(labels.share, url);
    }
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-profile-border bg-profile-surface px-3 text-xs font-bold text-profile-text transition hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Share2 className="h-3.5 w-3.5" aria-hidden />}
        {labels.share}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? labels.copied : ""}
      </span>
      {copied ? (
        <span
          aria-hidden
          className="profile-rise absolute right-0 top-full z-30 mt-1.5 whitespace-nowrap rounded-full bg-accent-cta px-3 py-1 text-xs font-bold text-accent-on-cta"
        >
          {labels.copied}
        </span>
      ) : null}
    </span>
  );
}
