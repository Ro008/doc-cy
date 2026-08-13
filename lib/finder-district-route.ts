import type { Metadata } from "next";

import FinderPage, {
  generateMetadata as generateFinderMetadata,
} from "@/app/finder/[[...filters]]/page";
import { FINDER_DISTRICT_PATH_SLUGS } from "@/lib/finder-public-path";

export type FinderDistrictRouteSlug =
  | "nicosia"
  | "limassol"
  | "paphos"
  | "larnaca"
  | "famagusta"
  | "all";

export type FinderDistrictPageProps = {
  params: {
    filters?: string[];
  };
  searchParams?: {
    district?: string;
    specialty?: string;
    name?: string;
    lat?: string;
    lon?: string;
    page?: string;
  };
};

function assertDistrictRouteSlug(slug: string): asserts slug is FinderDistrictRouteSlug {
  if (!FINDER_DISTRICT_PATH_SLUGS.has(slug)) {
    throw new Error(`Unknown finder district route slug: ${slug}`);
  }
}

function withDistrict(districtSlug: FinderDistrictRouteSlug, props: FinderDistrictPageProps) {
  return {
    params: { filters: [districtSlug, ...(props.params.filters ?? [])] },
    searchParams: props.searchParams,
  };
}

export function districtFinderGenerateMetadata(
  districtSlug: FinderDistrictRouteSlug,
  props: FinderDistrictPageProps,
): Promise<Metadata> {
  assertDistrictRouteSlug(districtSlug);
  return generateFinderMetadata(withDistrict(districtSlug, props));
}

export function DistrictFinderPage(
  districtSlug: FinderDistrictRouteSlug,
  props: FinderDistrictPageProps,
) {
  assertDistrictRouteSlug(districtSlug);
  return FinderPage(withDistrict(districtSlug, props));
}
