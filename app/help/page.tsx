import type { Metadata } from "next";

import { HelpCopyLinkButton } from "@/components/help/HelpCopyLinkButton";
import { HelpVideoCard } from "@/components/help/HelpVideoCard";
import { HELP_MANUAL } from "@/lib/help-manual";

export const metadata: Metadata = {
  title: "Help & tutorials | DocCy",
  description: "Short how-to videos and steps for professionals using DocCy.",
  // Inside the professional's login: nothing to index.
  robots: { index: false, follow: false },
};

function ContentsList() {
  return (
    <ul className="space-y-4 text-sm">
      {HELP_MANUAL.map((section) => (
        <li key={section.id}>
          <a href={`#${section.id}`} className="font-semibold text-slate-100 hover:text-clinical-200">
            {section.title}
          </a>
          <ul className="mt-1.5 space-y-1 border-l border-slate-700/70 pl-3">
            {section.articles.map((article) => (
              <li key={article.slug}>
                <a href={`#${article.slug}`} className="text-slate-400 hover:text-clinical-200">
                  {article.title}
                </a>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-ink-900 text-slate-50" data-testid="help-root">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-clinical-500/10 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-clinical-400/10 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Help &amp; tutorials</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-400">
            One short video per task, with the steps written underneath. Every section has its own link, so you can
            share it as it is.
          </p>
        </header>

        <div className="mt-6 grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <details
              className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 lg:hidden"
              data-testid="help-contents-mobile"
            >
              <summary className="cursor-pointer text-sm font-semibold text-slate-100">In this manual</summary>
              <div className="mt-3">
                <ContentsList />
              </div>
            </details>
            <nav aria-label="In this manual" className="hidden lg:block" data-testid="help-contents">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">In this manual</p>
              <ContentsList />
            </nav>
          </aside>

          <div className="min-w-0 space-y-12">
            {HELP_MANUAL.map((section) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-heading`}
                className="scroll-mt-24"
              >
                <h2 id={`${section.id}-heading`} className="text-xl font-semibold tracking-tight text-slate-50">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-10">
                  {section.articles.map((article) => (
                    <article
                      key={article.slug}
                      id={article.slug}
                      data-testid="help-article"
                      className="scroll-mt-24 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold tracking-tight text-slate-50">{article.title}</h3>
                          <p className="mt-1 text-sm leading-6 text-slate-400">{article.summary}</p>
                        </div>
                        <HelpCopyLinkButton slug={article.slug} title={article.title} />
                      </div>
                      {article.video ? <HelpVideoCard title={article.title} video={article.video} /> : null}
                      <ol className="space-y-2.5 text-sm leading-6 text-slate-200" data-testid="help-steps">
                        {article.steps.map((step, index) => (
                          <li key={step} className="flex gap-3">
                            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-clinical-500/20 text-xs font-bold text-clinical-200">
                              {index + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
