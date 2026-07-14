import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { ManualDirectoryLandingBrowseLink, ManualDirectoryLandingCard } from "@/components/finder/ManualDirectoryLandingCard";
import { ManualDirectoryStructuredData } from "@/components/finder/ManualDirectoryStructuredData";
import { PendingLink } from "@/components/navigation/PendingLink";
import { loadManualDirectoryBySlug } from "@/lib/load-manual-directory-by-slug";
import {
  buildManualDirectorySeoDescription,
  buildManualDirectorySeoTitle,
  getManualDirectorySpecialtySeoLabel,
} from "@/lib/manual-directory-seo";
import { districtToSlug, specialtyToSlug } from "@/lib/finder-seo";
import { phoneToTelHref } from "@/lib/phone-link";
import { buildFinderAvailabilityDayHeaders } from "@/lib/public/compute-public-booking-slots";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: { slug: string };
};

function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.mydoccy.com").replace(
    /\/+$/,
    "",
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { title: "Healthcare Professional | DocCy" };
  }

  const row = await loadManualDirectoryBySlug(supabase, params.slug);
  if (!row) {
    return { title: "Professional not found | DocCy", robots: { index: false, follow: false } };
  }

  const pageUrl = `${siteBaseUrl()}/finder/doctor/${row.slug}`;
  const title = buildManualDirectorySeoTitle({
    name: row.displayName,
    specialty: row.specialty,
    district: row.district,
  });
  const description = buildManualDirectorySeoDescription({
    name: row.displayName,
    specialty: row.specialty,
    district: row.district,
    phone: row.phone,
  });

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      type: "website",
      url: pageUrl,
      ...(row.photoUrl ? { images: [{ url: row.photoUrl }] } : {}),
    },
    twitter: {
      card: row.photoUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(row.photoUrl ? { images: [row.photoUrl] } : {}),
    },
  };
}

export default async function ManualDirectoryDoctorPage({ params }: PageProps) {
  const supabase = createServiceRoleClient();
  if (!supabase) notFound();

  const row = await loadManualDirectoryBySlug(supabase, params.slug);
  if (!row) notFound();

  const siteUrl = siteBaseUrl();
  const pageUrl = `${siteUrl}/finder/doctor/${row.slug}`;
  const specialtySeoLabel = getManualDirectorySpecialtySeoLabel(row.specialty);
  const districtSlug = districtToSlug(row.district);
  const specialtySlug = specialtyToSlug(row.specialty);
  const mapsUrl = row.address_maps_link.trim();
  const telHref = phoneToTelHref(row.phone);
  const dayHeaders = buildFinderAvailabilityDayHeaders();

  return (
    <main className="min-h-screen bg-ink-50 text-ink-900">
      <ManualDirectoryStructuredData
        siteUrl={siteUrl}
        pageUrl={pageUrl}
        name={row.displayName}
        specialty={row.specialty}
        district={row.district}
        phone={row.phone}
        mapsUrl={mapsUrl}
      />

      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <PendingLink href="/finder" className="inline-flex items-center">
            <DocCyWordmark className="h-7 w-auto" />
          </PendingLink>
          <PendingLink
            href="/finder"
            className="text-sm font-medium text-clinical-700 hover:underline"
          >
            Back to Finder
          </PendingLink>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-500">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <PendingLink href="/finder" className="hover:text-clinical-700 hover:underline">
                Finder
              </PendingLink>
            </li>
            <li aria-hidden="true">›</li>
            <li>
              <PendingLink
                href={`/finder/${districtSlug}`}
                className="hover:text-clinical-700 hover:underline"
              >
                {row.district}
              </PendingLink>
            </li>
            <li aria-hidden="true">›</li>
            <li className="font-medium text-ink-800">{row.displayName}</li>
          </ol>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
          {row.displayName}
        </h1>
        <p className="mt-2 text-sm font-medium text-ink-600">
          {specialtySeoLabel} · {row.district}, Cyprus
        </p>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-700">
          {row.displayName} is listed on DocCy as a {specialtySeoLabel.toLowerCase()} professional
          in {row.district}. View their location on Google Maps
          {row.phone ? " or call the clinic" : ""}, then request an appointment through DocCy when
          online booking is not yet activated on their profile.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-800 shadow-sm hover:border-clinical-300 hover:text-clinical-800"
            >
              View on Google Maps
            </a>
          ) : null}
          {telHref ? (
            <a
              href={telHref}
              className="inline-flex items-center rounded-full border border-clinical-200 bg-clinical-50 px-4 py-2 text-sm font-semibold text-clinical-800 hover:bg-clinical-100"
            >
              Call {row.phone}
            </a>
          ) : null}
        </div>

        <section className="mt-8" aria-label="Directory listing">
          <ManualDirectoryLandingCard row={row} dayHeaders={dayHeaders} />
        </section>

        <div className="mt-6">
          <ManualDirectoryLandingBrowseLink
            district={row.district}
            specialty={specialtySeoLabel}
            districtSlug={districtSlug}
            specialtySlug={specialtySlug}
          />
        </div>
      </div>
    </main>
  );
}
