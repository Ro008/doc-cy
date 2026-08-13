import {
  DistrictFinderPage,
  districtFinderGenerateMetadata,
  type FinderDistrictPageProps,
} from "@/lib/finder-district-route";

export { dynamic, revalidate } from "../../finder/[[...filters]]/page";

export function generateMetadata(props: FinderDistrictPageProps) {
  return districtFinderGenerateMetadata("limassol", props);
}

export default function LimassolFinderPage(props: FinderDistrictPageProps) {
  return DistrictFinderPage("limassol", props);
}
