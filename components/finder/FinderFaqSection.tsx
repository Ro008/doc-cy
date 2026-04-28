type FinderFaqSectionProps = {
  siteUrl: string;
  finderPath: string;
  specialtyLabel: string;
  districtLabel: string;
  hasSpecificFilters: boolean;
};

type FaqItem = {
  question: string;
  answer: string;
};

function stringifyJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function FinderFaqSection({
  siteUrl,
  finderPath,
  specialtyLabel,
  districtLabel,
  hasSpecificFilters,
}: FinderFaqSectionProps) {
  const faqItems: FaqItem[] = hasSpecificFilters
    ? [
        {
          question: `How can I find English-speaking ${specialtyLabel} in ${districtLabel}?`,
          answer: `Use this page to browse English-speaking ${specialtyLabel} in ${districtLabel}, compare options, and book online with the professional that matches your needs.`,
        },
        {
          question: `Can I book online with a ${specialtyLabel} in ${districtLabel}?`,
          answer: `Yes. Many professionals listed here allow you to book online directly from their profile page.`,
        },
        {
          question: `Are these ${specialtyLabel} in ${districtLabel} verified?`,
          answer:
            "DocCy prioritizes verified professionals and provides profile details to help you choose with confidence.",
        },
      ]
    : [
        {
          question: "How can I find English-speaking health professionals in Cyprus?",
          answer:
            "Use the finder filters by district and specialty to discover English-speaking professionals across Cyprus and book online.",
        },
        {
          question: "Can I book online through DocCy?",
          answer:
            "Yes. You can open professional profiles and book online when online booking is available.",
        },
        {
          question: "Which districts are covered?",
          answer:
            "DocCy includes professionals across Cyprus, including Nicosia, Limassol, Paphos, Larnaca, and Famagusta.",
        },
      ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
    url: `${siteUrl}${finderPath}`,
  };

  return (
    <section className="mt-10 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5">
      <h2 className="text-lg font-semibold text-white">Frequently asked questions</h2>
      <div className="mt-4 space-y-4">
        {faqItems.map((item) => (
          <article key={item.question} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <h3 className="text-sm font-semibold text-slate-100">{item.question}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.answer}</p>
          </article>
        ))}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(faqSchema) }}
      />
    </section>
  );
}

