import type { Metadata } from "next";

import { HelpBrowser } from "@/components/help/HelpBrowser";

export const metadata: Metadata = {
  title: "Help & tutorials | DocCy",
  description: "Short how-to videos and steps for professionals using DocCy.",
  // Inside the professional's login: nothing to index.
  robots: { index: false, follow: false },
};

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-ink-900 text-slate-50" data-testid="help-root">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-clinical-500/10 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-clinical-400/10 blur-3xl" />
      </div>
      <HelpBrowser />
    </main>
  );
}
