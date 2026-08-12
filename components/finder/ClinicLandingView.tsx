import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { ClinicContactActions } from "@/components/finder/ClinicContactActions";
import { ClinicProfessionalsBySpecialty } from "@/components/finder/ClinicProfessionalsBySpecialty";
import { RecordRecentlyViewed } from "@/components/finder/RecordRecentlyViewed";
import { PendingLink } from "@/components/navigation/PendingLink";
import { clinicLandingPath } from "@/lib/clinic-landing-path";
import { clinicsResultsPath } from "@/lib/clinics-public-path";
import type { ClinicLandingRow } from "@/lib/load-clinic-by-slug";

export function ClinicLandingView({ clinic }: { clinic: ClinicLandingRow }) {
  const mapsHref = clinic.address_maps_link?.trim() || null;
  const hasPhone = Boolean(String(clinic.phone ?? "").trim());

  return (
    <main className="min-h-screen bg-ink-50 text-ink-900">
      <RecordRecentlyViewed
        item={{
          kind: "clinic",
          href: clinicLandingPath(clinic.slug),
          name: clinic.name,
          subtitle: "Clinic",
          location: clinic.district,
          photoUrl: clinic.photoUrl,
        }}
      />
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <PendingLink href="/" className="inline-flex items-center">
            <DocCyWordmark className="h-7 w-auto" />
          </PendingLink>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-500">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <PendingLink href="/clinics" className="hover:text-clinical-700 hover:underline">
                Find a Clinic
              </PendingLink>
            </li>
            <li aria-hidden="true">›</li>
            <li>
              <PendingLink
                href={clinicsResultsPath(clinic.district)}
                className="hover:text-clinical-700 hover:underline"
              >
                {clinic.district}
              </PendingLink>
            </li>
            <li aria-hidden="true">›</li>
            <li className="font-medium text-ink-800">{clinic.name}</li>
          </ol>
        </nav>

        <div className="flex items-start gap-4 sm:gap-5">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-clinical-200 bg-clinical-50 ring-2 ring-clinical-100 sm:h-28 sm:w-28">
            <img
              src={clinic.photoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 pt-1">
            <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
              {clinic.name}
            </h1>
            <p className="mt-2 text-sm font-medium text-ink-600">
              Clinic · {clinic.district}, Cyprus
            </p>
          </div>
        </div>

        <section
          className="mt-6 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm sm:p-6"
          aria-label="Clinic details"
        >
          {clinic.address ? (
            <p className="text-sm leading-relaxed text-ink-700">{clinic.address}</p>
          ) : null}
          <div className={clinic.address ? "mt-4" : ""}>
            <ClinicContactActions
              clinicId={clinic.id}
              hasPhone={hasPhone}
              mapsHref={mapsHref}
            />
          </div>
        </section>

        <section className="mt-8" aria-label="Professionals at this clinic">
          <h2 className="text-lg font-bold tracking-tight text-ink-900">
            Professionals at this clinic
          </h2>
          <ClinicProfessionalsBySpecialty professionals={clinic.professionals} />
        </section>
      </div>
    </main>
  );
}

export function clinicLandingCanonicalPath(slug: string): string {
  return clinicLandingPath(slug);
}
