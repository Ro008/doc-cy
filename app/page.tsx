import type { Metadata } from "next";
import FinderPage, {
  generateMetadata as generateFinderMetadata,
} from "./finder/[[...filters]]/page";

export { dynamic, revalidate } from "./finder/[[...filters]]/page";

type HomePageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

/**
 * Patient homepage = finder (unfiltered).
 * District/specialty URLs (`/larnaca`, `/all/dentistry`) are real App Router
 * pages too, so filter changes use client navigation.
 */
export async function generateMetadata(props: HomePageProps): Promise<Metadata> {
  return generateFinderMetadata({
    params: {},
    searchParams: props.searchParams,
  });
}

export default async function HomePage(props: HomePageProps) {
  return FinderPage({
    params: {},
    searchParams: props.searchParams,
  });
}
