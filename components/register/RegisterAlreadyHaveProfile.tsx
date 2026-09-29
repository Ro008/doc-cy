import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { RegisterHasProfileContactButton } from "@/components/register/RegisterHasProfileContactButton";
import { registerSectionShell } from "@/lib/register-ui";

/**
 * /register for a signed-in professional: she already has a profile, so no form
 * (bug, 2026-09-29). A listing that is also her is merged by the founders by hand.
 */
export function RegisterAlreadyHaveProfile({ listingName }: { listingName: string | null }) {
  return (
    <main className="min-h-screen bg-white text-ink-900">
      <div className="mx-auto flex max-w-[640px] flex-col gap-6 px-4 pb-10 sm:px-8">
        <header className="flex h-16 items-center">
          <a href="/" className="inline-flex rounded-md transition hover:opacity-90" aria-label="DocCy home">
            <DocCyWordmark size="lg" />
          </a>
        </header>
        <section className={`${registerSectionShell} space-y-4 text-sm text-ink-700`}>
          <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">
            You already have a DocCy profile
          </h1>
          <p>
            Each professional has one profile on DocCy. To change your details, open your settings.
          </p>
          <p>
            {listingName ? (
              <>
                If the listing <span className="font-medium text-ink-900">{listingName}</span> is
                also you (for example, an old directory entry), contact us and we&apos;ll merge it
                into your profile.
              </>
            ) : (
              <>
                If another listing in the directory is also you (for example, an old directory
                entry), contact us and we&apos;ll merge it into your profile.
              </>
            )}
          </p>
          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <a
              href="/agenda"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-clinical-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-clinical-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500 focus-visible:ring-offset-2"
            >
              Go to my agenda
            </a>
            <RegisterHasProfileContactButton
              listingName={listingName}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 transition hover:border-clinical-300 hover:text-clinical-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500 focus-visible:ring-offset-2"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
