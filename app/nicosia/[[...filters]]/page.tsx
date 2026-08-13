import {
  DistrictFinderPage,
  districtFinderGenerateMetadata,
  type FinderDistrictPageProps,
} from "@/lib/finder-district-route";

export { dynamic, revalidate } from "../../finder/[[...filters]]/page";

export function generateMetadata(props: FinderDistrictPageProps) {
  return districtFinderGenerateMetadata("nicosia", props);
}

export default function NicosiaFinderPage(props: FinderDistrictPageProps) {
  return DistrictFinderPage("nicosia", props);
}
