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
 * Exists as a real App Router page so client soft-navigation to `/` works;
 * district/specialty public URLs still rely on middleware rewrite + hard navigation.
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
