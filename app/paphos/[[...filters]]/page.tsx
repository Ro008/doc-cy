import {
  DistrictFinderPage,
  districtFinderGenerateMetadata,
  type FinderDistrictPageProps,
} from "@/lib/finder-district-route";

export { dynamic, revalidate } from "../../finder/[[...filters]]/page";

export function generateMetadata(props: FinderDistrictPageProps) {
  return districtFinderGenerateMetadata("paphos", props);
}

export default function PaphosFinderPage(props: FinderDistrictPageProps) {
  return DistrictFinderPage("paphos", props);
}
