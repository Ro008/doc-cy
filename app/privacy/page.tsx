import type { Metadata } from "next";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { MarketingFooter } from "@/components/navigation/MarketingFooter";
import { PendingLink } from "@/components/navigation/PendingLink";
import { CookiePreferencesButton } from "@/components/navigation/CookiePreferencesButton";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com").replace(
  /\/+$/,
  "",
);

export const metadata: Metadata = {
  title: "Privacy | DocCy",
  description:
    "How DocCy uses cookies and similar technologies, including Google Ads measurement and essential product cookies.",
  alternates: { canonical: `${siteUrl}/privacy` },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "18 August 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-ink-50 px-4 py-8 text-ink-800 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <PendingLink href="/" className="inline-flex hover:opacity-90">
            <DocCyWordmark variant="light" size="lg" />
          </PendingLink>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink-900">Privacy</h1>
          <p className="mt-2 text-sm text-ink-500">Last updated: {LAST_UPDATED}</p>
        </header>

        <article className="space-y-8 text-sm leading-relaxed text-ink-700">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">1. Who we are</h2>
            <p>
              DocCy (&quot;we&quot;, &quot;us&quot;) operates the website at{" "}
              <a href={siteUrl} className="font-medium text-clinical-700 underline underline-offset-2">
                {siteUrl.replace(/^https?:\/\//, "")}
              </a>
              . We are based in the Republic of Cyprus. This page explains the cookies and similar
              technologies we use when you visit DocCy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">2. Essential cookies</h2>
            <p>
              Some cookies are needed for the Service to work: signing in, keeping a professional
              session, security, and remembering your cookie choice. These are not advertising
              cookies and we do not ask for a separate opt-in before setting them.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">3. First-party usage stats</h2>
            <p>
              We store a first-party session identifier so we can see, in aggregate, how people use
              the public directory (for example visits to Finder). We use this to operate and
              improve DocCy. We do not sell this data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">4. Hosting and performance</h2>
            <p>
              DocCy is hosted on Vercel. Vercel Analytics and Speed Insights help us understand
              site performance. These tools are not used to show you ads.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">5. Google Ads</h2>
            <p>
              If you accept ads cookies, we load Google&apos;s tag so we can measure whether our
              Google Ads campaigns lead to actions such as showing a phone number or requesting
              online booking.
              Google may set cookies and process data as described in{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-clinical-700 underline underline-offset-2"
              >
                Google&apos;s Privacy Policy
              </a>
              .
            </p>
            <p>
              If you reject ads cookies, you can still use DocCy. We tell Google that ads storage
              is denied (Consent Mode). Google may still receive limited, cookieless pings for
              modelled conversion measurement.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">6. Your choice</h2>
            <p>
              You can accept or reject ads cookies in the banner, or change your mind later on this
              page (kept for 12 months). Rejecting ads cookies does not block Finder, booking, or
              professional accounts.
            </p>
            <p>
              <CookiePreferencesButton className="font-semibold text-clinical-700 underline underline-offset-2 hover:text-clinical-600" />
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">7. Contact</h2>
            <p>
              Privacy questions: use Support on the DocCy website, or see{" "}
              <PendingLink
                href="/for-professionals"
                className="font-medium text-clinical-700 underline underline-offset-2"
              >
                About DocCy
              </PendingLink>
              .{" "}
              <PendingLink
                href="/terms"
                className="font-medium text-clinical-700 underline underline-offset-2"
              >
                Terms of Use
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
