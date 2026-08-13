import {
  DistrictFinderPage,
  districtFinderGenerateMetadata,
  type FinderDistrictPageProps,
} from "@/lib/finder-district-route";

export { dynamic, revalidate } from "../../finder/[[...filters]]/page";

export function generateMetadata(props: FinderDistrictPageProps) {
  return districtFinderGenerateMetadata("larnaca", props);
}

export default function LarnacaFinderPage(props: FinderDistrictPageProps) {
  return DistrictFinderPage("larnaca", props);
}
