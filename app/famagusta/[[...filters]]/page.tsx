import {
  DistrictFinderPage,
  districtFinderGenerateMetadata,
  type FinderDistrictPageProps,
} from "@/lib/finder-district-route";

export { dynamic, revalidate } from "../../finder/[[...filters]]/page";

export function generateMetadata(props: FinderDistrictPageProps) {
  return districtFinderGenerateMetadata("famagusta", props);
}

export default function FamagustaFinderPage(props: FinderDistrictPageProps) {
  return DistrictFinderPage("famagusta", props);
}
