import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { ManualDirectoryLandingBrowseLink, ManualDirectoryLandingCard } from "@/components/finder/ManualDirectoryLandingCard";
import { ManualDirectoryStructuredData } from "@/components/finder/ManualDirectoryStructuredData";
import { PendingLink } from "@/components/navigation/PendingLink";
import { districtToSlug, specialtyToSlug } from "@/lib/finder-seo";
import { loadManualDirectoryBySlug } from "@/lib/load-manual-directory-by-slug";
import { manualDirectoryLandingPath } from "@/lib/manual-directory-landing-path";
import {
  buildManualDirectorySeoDescription,
  buildManualDirectorySeoTitle,
  getManualDirectorySpecialtySeoLabel,
} from "@/lib/manual-directory-seo";
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

  const pageUrl = `${siteBaseUrl()}${manualDirectoryLandingPath(row.slug)}`;
  const title = buildManualDirectorySeoTitle({
    name: row.displayName,
    specialty: row.specialty,
    district: row.district,
  });
  const description = buildManualDirectorySeoDescription({
    name: row.displayName,
    specialty: row.specialty,
    district: row.district,
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

export default async function ManualDirectoryProfessionalPage({ params }: PageProps) {
  const supabase = createServiceRoleClient();
  if (!supabase) notFound();

  const row = await loadManualDirectoryBySlug(supabase, params.slug);
  if (!row) notFound();

  const siteUrl = siteBaseUrl();
  const pageUrl = `${siteUrl}${manualDirectoryLandingPath(row.slug)}`;
  const specialtySeoLabel = getManualDirectorySpecialtySeoLabel(row.specialty);
  const districtSlug = districtToSlug(row.district);
  const specialtySlug = specialtyToSlug(row.specialty);
  const dayHeaders = buildFinderAvailabilityDayHeaders();

  return (
    <main className="min-h-screen bg-ink-50 text-ink-900">
      <ManualDirectoryStructuredData
        siteUrl={siteUrl}
        pageUrl={pageUrl}
        name={row.displayName}
        specialty={row.specialty}
        district={row.district}
        mapsUrl={row.address_maps_link.trim()}
      />

      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <PendingLink href="/finder" className="inline-flex items-center">
            <DocCyWordmark className="h-7 w-auto" />
          </PendingLink>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
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

        <section className="mt-6" aria-label="Directory listing">
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
