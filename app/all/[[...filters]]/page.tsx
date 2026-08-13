import {
  DistrictFinderPage,
  districtFinderGenerateMetadata,
  type FinderDistrictPageProps,
} from "@/lib/finder-district-route";

export { dynamic, revalidate } from "../../finder/[[...filters]]/page";

export function generateMetadata(props: FinderDistrictPageProps) {
  return districtFinderGenerateMetadata("all", props);
}

export default function AllDistrictsFinderPage(props: FinderDistrictPageProps) {
  return DistrictFinderPage("all", props);
}
