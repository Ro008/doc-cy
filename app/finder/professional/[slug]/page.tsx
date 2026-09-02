import { notFound, permanentRedirect } from "next/navigation";
import {
  loadManualDirectoryBySlug,
  resolveAbsorbedProfessionalSlugRedirect,
  resolveCanonicalManualDirectorySlug,
} from "@/lib/load-manual-directory-by-slug";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: { slug: string };
};

/**
 * Legacy unregistered landing. Canonical URL is `/{locale}/{slug}` for every
 * professional. next.config also 301s this path; this page is a fallback.
 */
export default async function LegacyManualDirectoryProfessionalPage({ params }: PageProps) {
  const slug = String(params.slug ?? "").trim();
  if (!slug) notFound();

  const supabase = createServiceRoleClient();
  if (supabase) {
    const absorbed = await resolveAbsorbedProfessionalSlugRedirect(supabase, slug);
    if (absorbed) {
      permanentRedirect(publicProfessionalProfilePath(absorbed));
    }
    const canonical = await resolveCanonicalManualDirectorySlug(supabase, slug);
    if (canonical) {
      permanentRedirect(publicProfessionalProfilePath(canonical));
    }
    const row = await loadManualDirectoryBySlug(supabase, slug);
    if (row?.slug) {
      permanentRedirect(publicProfessionalProfilePath(row.slug));
    }
  }

  permanentRedirect(publicProfessionalProfilePath(slug));
}
