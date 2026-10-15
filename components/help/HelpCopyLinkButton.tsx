"use client";

import * as React from "react";
import { Check, Link2 } from "lucide-react";

import { helpArticlePath } from "@/lib/help-manual";

/** Copies the link to one article (/help#slug), so a section can be shared as it is. */
export function HelpCopyLinkButton({ slug, title }: { slug: string; title: string }) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    const url = `${window.location.origin}${helpArticlePath(slug)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard refused (older browsers, some app views): the address bar still has the anchor.
      window.location.hash = slug;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy link to ${title}`}
      data-testid="help-copy-link"
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-pro-line/80 px-2.5 text-xs font-semibold text-slate-300 transition hover:border-clinical-400/60 hover:text-clinical-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-clinical-300" aria-hidden />
      ) : (
        <Link2 className="h-3.5 w-3.5" aria-hidden />
      )}
      <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
    </button>
  );
}
