"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowRight, Clock, ListChecks, Play, Search, X } from "lucide-react";

import { HelpContactButton } from "@/components/help/HelpContactButton";
import { HelpCopyLinkButton } from "@/components/help/HelpCopyLinkButton";
import { HelpVideoCard } from "@/components/help/HelpVideoCard";
import { HELP_MANUAL, filterHelpManual, nextHelpArticle, type HelpArticle } from "@/lib/help-manual";

function ContentsList({ sections }: { sections: typeof HELP_MANUAL }) {
  return (
    <ul className="space-y-4 text-sm">
      {sections.map((section) => (
        <li key={section.id}>
          <a href={`#${section.id}`} className="font-semibold text-slate-100 hover:text-clinical-200">
            {section.title}
          </a>
          <ul className="mt-1.5 space-y-1 border-l border-pro-line/70 pl-3">
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

/** A tutorial in the overview: thumbnail, length, title; one tap to the article. */
function TutorialCard({ article }: { article: HelpArticle }) {
  return (
    <a
      href={`#${article.slug}`}
      data-testid="help-tutorial-card"
      className="group flex flex-col overflow-hidden rounded-2xl border border-pro-line/70 bg-pro-card transition hover:-translate-y-0.5 hover:border-clinical-400/50 hover:shadow-xl hover:shadow-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70"
    >
      {article.video ? (
        <div className="relative aspect-video w-full bg-pro-page">
          <Image
            src={article.video.poster}
            alt=""
            fill
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
          <span className="absolute inset-0 bg-pro-page/25" aria-hidden />
          <span className="absolute left-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-clinical-500 text-ink-900 shadow-lg">
            <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden />
          </span>
          <span className="absolute bottom-2.5 right-2.5 rounded-md bg-pro-page/85 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
            {article.video.durationLabel}
          </span>
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold leading-snug tracking-tight text-slate-50">{article.title}</h3>
        <p className="mt-1 flex-1 text-sm leading-6 text-slate-400">{article.summary}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-clinical-300 group-hover:text-clinical-200">
          Watch and read
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </a>
  );
}

function ContactCard({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="rounded-2xl border border-clinical-400/30 bg-gradient-to-br from-clinical-500/15 to-pro-card/60 p-5">
      <p className="text-base font-semibold text-slate-50">{heading}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{body}</p>
      <div className="mt-4">
        <HelpContactButton />
      </div>
    </div>
  );
}

export function HelpBrowser() {
  const [query, setQuery] = React.useState("");
  const sections = React.useMemo(() => filterHelpManual(HELP_MANUAL, query), [query]);
  const searching = query.trim().length > 0;
  const resultCount = sections.reduce((n, section) => n + section.articles.length, 0);
  const totalCount = HELP_MANUAL.reduce((n, section) => n + section.articles.length, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-14 lg:pt-8">
      <header className="relative overflow-hidden rounded-3xl border border-clinical-400/25 bg-gradient-to-br from-clinical-500/20 via-pro-card/80 to-pro-page px-5 py-8 sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-clinical-400/20 blur-3xl" aria-hidden />
        <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-clinical-300">Help &amp; tutorials</p>
        <h1 className="relative mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
          How can we help?
        </h1>
        <p className="relative mt-2 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
          Short videos with the steps written underneath, so you can get on with your day. Search for what you need,
          or pick a tutorial.
        </p>

        <div className="relative mt-6 max-w-xl">
          <label htmlFor="help-search" className="sr-only">
            Search the tutorials
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            id="help-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search, e.g. decline"
            autoComplete="off"
            data-testid="help-search"
            className="w-full rounded-full border border-slate-600/70 bg-pro-page/80 py-3 pl-12 pr-11 text-base text-slate-50 placeholder:text-slate-500 focus:border-clinical-400/70 focus:outline-none focus:ring-2 focus:ring-clinical-400/40"
          />
          {searching ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-700/60 hover:text-slate-100"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="relative mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
            <Clock className="h-4 w-4 text-clinical-300" aria-hidden />
            {totalCount} {totalCount === 1 ? "short tutorial" : "short tutorials"}
          </span>
          <span className="hidden text-slate-600 sm:inline" aria-hidden>
            |
          </span>
          <span className="text-sm text-slate-300">Can&apos;t find it? We are one message away.</span>
          <HelpContactButton variant="soft" label="Contact us" testId="help-contact-hero" />
        </div>
      </header>

      <p className="sr-only" role="status" aria-live="polite">
        {searching ? `${resultCount} ${resultCount === 1 ? "tutorial" : "tutorials"} found` : ""}
      </p>

      {!searching ? (
        <section aria-labelledby="help-overview-heading" className="mt-8">
          <h2 id="help-overview-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Pick a tutorial
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HELP_MANUAL.flatMap((section) => section.articles).map((article) => (
              <TutorialCard key={article.slug} article={article} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-10 grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <details
            className="rounded-2xl border border-pro-line/70 bg-pro-card p-4 lg:hidden"
            data-testid="help-contents-mobile"
          >
            <summary className="cursor-pointer text-sm font-semibold text-slate-100">In this manual</summary>
            <div className="mt-3">
              <ContentsList sections={sections} />
            </div>
          </details>
          <nav aria-label="In this manual" className="hidden lg:block" data-testid="help-contents">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">In this manual</p>
            <ContentsList sections={sections} />
          </nav>
          <div className="hidden rounded-2xl border border-pro-line/70 bg-pro-card p-4 lg:block">
            <p className="text-sm font-semibold text-slate-100">Need a hand?</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">Write to us. We read every message.</p>
            <div className="mt-3">
              <HelpContactButton variant="soft" testId="help-contact-aside" />
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-14">
          {sections.length === 0 ? (
            <div className="rounded-2xl border border-pro-line/70 bg-pro-card p-6 text-center" data-testid="help-empty">
              <p className="text-base font-semibold text-slate-50">Nothing matches &ldquo;{query.trim()}&rdquo;</p>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-400">
                Try another word, or tell us what you are trying to do and we will help you, and may make a tutorial
                for it.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded-full border border-slate-600/70 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-pro-raised"
                >
                  Show all tutorials
                </button>
                <HelpContactButton testId="help-contact-empty" />
              </div>
            </div>
          ) : null}

          {sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-24">
              <h2 id={`${section.id}-heading`} className="text-2xl font-semibold tracking-tight text-slate-50">
                {section.title}
              </h2>
              <div className="mt-5 space-y-8">
                {section.articles.map((article) => {
                  const next = nextHelpArticle(article.slug);
                  return (
                    <article
                      key={article.slug}
                      id={article.slug}
                      data-testid="help-article"
                      className="scroll-mt-24 rounded-3xl border border-pro-line/70 bg-pro-card p-4 shadow-lg shadow-black/10 sm:p-6"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-xl font-semibold tracking-tight text-slate-50">{article.title}</h3>
                          <p className="mt-1 text-sm leading-6 text-slate-400">{article.summary}</p>
                        </div>
                        <HelpCopyLinkButton slug={article.slug} title={article.title} />
                      </div>

                      {article.video ? (
                        <div className="mt-4">
                          <HelpVideoCard title={article.title} video={article.video} />
                        </div>
                      ) : null}

                      <div className="mt-5 rounded-2xl bg-pro-page/60 p-4 sm:p-5">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-clinical-300">
                          <ListChecks className="h-4 w-4" aria-hidden />
                          Step by step
                        </p>
                        <ol className="mt-3 space-y-3 text-sm leading-6 text-slate-200" data-testid="help-steps">
                          {article.steps.map((step, index) => (
                            <li key={step} className="flex gap-3">
                              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-clinical-500 text-xs font-bold text-ink-900">
                                {index + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-pro-line/60 pt-4">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          Still unsure?
                          <HelpContactButton
                            variant="link"
                            label="Ask us"
                            message={`About the tutorial "${article.title}": `}
                            testId="help-contact-article"
                          />
                        </div>
                        {next ? (
                          <a
                            href={`#${next.slug}`}
                            data-testid="help-next"
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-clinical-300 hover:text-clinical-200"
                          >
                            Next: {next.title}
                            <ArrowRight className="h-4 w-4" aria-hidden />
                          </a>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          <ContactCard
            heading="Didn't find what you were looking for?"
            body="Tell us what you are trying to do. We read every message, and your questions decide the next tutorial."
          />
        </div>
      </div>
    </div>
  );
}
