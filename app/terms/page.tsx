import type { Metadata } from "next";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { MarketingFooter } from "@/components/navigation/MarketingFooter";
import { PendingLink } from "@/components/navigation/PendingLink";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com").replace(
  /\/+$/,
  "",
);

export const metadata: Metadata = {
  title: "Terms of Use | DocCy",
  description:
    "Terms of Use for DocCy, including acceptable use and prohibitions on scraping or copying DocCy directory data.",
  alternates: { canonical: `${siteUrl}/terms` },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "8 August 2026";

export default function TermsOfUsePage() {
  return (
    <main className="min-h-screen bg-ink-50 px-4 py-8 text-ink-800 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <PendingLink href="/" className="inline-flex hover:opacity-90">
            <DocCyWordmark variant="light" size="lg" />
          </PendingLink>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink-900">Terms of Use</h1>
          <p className="mt-2 text-sm text-ink-500">Last updated: {LAST_UPDATED}</p>
        </header>

        <article className="space-y-8 text-sm leading-relaxed text-ink-700">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">1. Agreement to these Terms</h2>
            <p>
              These Terms of Use (&quot;Terms&quot;) govern access to and use of the DocCy website,
              applications, and related services (collectively, the &quot;Service&quot;) operated at{" "}
              <a href={siteUrl} className="font-medium text-clinical-700 underline underline-offset-2">
                {siteUrl.replace(/^https?:\/\//, "")}
              </a>{" "}
              and related domains (together, &quot;DocCy&quot;, &quot;we&quot;, &quot;us&quot;, or
              &quot;our&quot;).
            </p>
            <p>
              By accessing or using the Service, you agree to be bound by these Terms. If you do not
              agree, do not use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">2. The Service</h2>
            <p>
              DocCy provides tools for patients to discover healthcare professionals and clinics in
              Cyprus, and for healthcare professionals to manage profiles, availability, and
              appointments. Directory listings may include information submitted by professionals,
              curated by DocCy, or derived from publicly available sources. Listing on DocCy does not
              mean DocCy endorses any professional, clinic, or medical service.
            </p>
            <p>
              DocCy is a technology platform. We do not provide medical advice, diagnosis, or
              treatment. Always seek the advice of a qualified healthcare professional with any
              questions about a medical condition.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">3. Accounts and eligibility</h2>
            <p>
              Some features require an account. You must provide accurate information and keep your
              credentials confidential. You are responsible for activity under your account. We may
              refuse, suspend, or terminate accounts that violate these Terms or applicable law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">4. Acceptable use</h2>
            <p>You agree to use the Service only for lawful purposes and in accordance with these Terms. Without limitation, you must not:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>interfere with or disrupt the Service, servers, or networks;</li>
              <li>attempt to gain unauthorised access to any systems, accounts, or data;</li>
              <li>bypass, disable, or circumvent security, access controls, or rate limits;</li>
              <li>use the Service to send spam, malware, or harmful content;</li>
              <li>misrepresent your identity or affiliation;</li>
              <li>
                use the Service in any way that infringes intellectual property, privacy, or other
                rights of DocCy or any third party.
              </li>
            </ul>
          </section>

          <section className="space-y-3 rounded-2xl border border-clinical-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-ink-900">
              5. Prohibition on scraping and database copying
            </h2>
            <p>
              The DocCy directory, databases, listings, profiles, contact details, availability data,
              structured data, APIs, and related compilations (collectively, the &quot;DocCy
              Data&quot;) are proprietary to DocCy and/or its licensors. DocCy Data is made available
              solely for interactive, personal, non-commercial browsing and booking through the
              Service&apos;s ordinary user interfaces, except where DocCy expressly grants other
              written permission.
            </p>
            <p className="font-medium text-ink-800">
              You must not, and must not assist or enable any third party to:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                scrape, crawl, spider, harvest, mine, mirror, frame, or systematically download DocCy
                Data;
              </li>
              <li>
                copy, extract, reproduce, republish, sell, license, sublicense, distribute, or create
                a competing database or directory from DocCy Data, in whole or in part;
              </li>
              <li>
                use bots, scripts, automated agents, bulk export tools, or similar means to access or
                collect DocCy Data beyond ordinary manual use of the Service;
              </li>
              <li>
                probe, query, or call DocCy APIs, public endpoints, or databases (including
                PostgREST/Supabase endpoints) to obtain DocCy Data outside authorised product
                features;
              </li>
              <li>
                reverse engineer, decompile, or attempt to reconstruct DocCy Data structures,
                schemas, or non-public interfaces for the purpose of extracting listings or contact
                data;
              </li>
              <li>
                use DocCy Data to train, fine-tune, or improve machine-learning or AI models, or to
                build or enrich any product, dataset, or service that competes with DocCy, without
                prior written consent from DocCy.
              </li>
            </ul>
            <p>
              Any unauthorised access to, or copying of, DocCy Data may violate these Terms,
              applicable intellectual property and database laws (including database sui generis
              rights where applicable), computer misuse laws, and other legal protections. DocCy
              reserves all rights and remedies, including technical blocking, account termination,
              and civil claims for damages and injunctive relief.
            </p>
            <p className="font-medium text-ink-800">
              Any unauthorized extraction or scraping of DocCy Data shall subject the infringing
              party to liquidated damages of €50 per record/profile extracted, without prejudice to
              DocCy&apos;s right to seek higher actual damages.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">6. Intellectual property</h2>
            <p>
              The Service—including software, design, trademarks, logos, text, graphics, and DocCy
              Data—is owned by DocCy or its licensors and is protected by intellectual property and
              other laws. Except for the limited right to use the Service as expressly permitted in
              these Terms, no licence is granted. &quot;DocCy&quot; and related marks are trademarks of
              DocCy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">7. Professional and clinic content</h2>
            <p>
              Professionals and clinics are responsible for the accuracy of information they submit
              (including specialties, contact details, fees, and availability). DocCy may edit,
              remove, or refuse listings that appear inaccurate, unlawful, or harmful to users or the
              Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">8. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
              OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE
              WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, OR THAT DIRECTORY INFORMATION IS
              COMPLETE OR CURRENT.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">9. Limitation of liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, DOCCY AND ITS OPERATORS, OFFICERS, AND
              AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
              PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF
              (OR INABILITY TO USE) THE SERVICE OR RELIANCE ON ANY DIRECTORY INFORMATION. OUR
              AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE SHALL NOT EXCEED THE
              GREATER OF (A) THE AMOUNTS YOU PAID TO DOCCY FOR THE SERVICE IN THE TWELVE (12) MONTHS
              BEFORE THE CLAIM OR (B) ONE HUNDRED EURO (€100).
            </p>
            <p>
              Nothing in these Terms excludes or limits liability that cannot be excluded or limited
              under applicable law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">10. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless DocCy from claims, damages, losses, and
              expenses (including reasonable legal fees) arising out of your misuse of the Service,
              your violation of these Terms, or your infringement of any third-party rights—
              including unauthorised scraping or copying of DocCy Data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">11. Suspension and termination</h2>
            <p>
              We may suspend or terminate access to the Service at any time if we reasonably believe
              you have violated these Terms, pose a security risk, or if required by law. Provisions
              that by their nature should survive (including Sections 5, 6, 8–10, and 12–14) will
              survive termination.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">12. Changes to these Terms</h2>
            <p>
              We may update these Terms from time to time. The &quot;Last updated&quot; date will
              change when we do. Continued use of the Service after changes become effective
              constitutes acceptance of the updated Terms. If you do not agree, stop using the
              Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">13. Governing law</h2>
            <p>
              These Terms are governed by the laws of the Republic of Cyprus, without regard to
              conflict-of-law principles. Courts of the Republic of Cyprus shall have exclusive
              jurisdiction over disputes arising from these Terms or the Service, subject to any
              mandatory consumer protections that apply to you.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">14. Contact</h2>
            <p>
              Questions about these Terms: use Support on the DocCy website, or contact us through
              the channels published on{" "}
              <PendingLink
                href="/for-professionals"
                className="font-medium text-clinical-700 underline underline-offset-2"
              >
                About DocCy
              </PendingLink>
              .
            </p>
          </section>
        </article>

        <MarketingFooter variant="light" className="mx-auto mt-10 w-full max-w-3xl pb-24 pt-2 sm:pb-16 lg:pb-12" />
      </div>
    </main>
  );
}
