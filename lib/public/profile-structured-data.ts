import type { DayKey } from "@/lib/doctor-settings";
import type { OpeningHoursGroup } from "@/lib/public/clinic-opening-hours";
import type { ProfileBreadcrumb } from "@/lib/public/profile-breadcrumbs";

/**
 * JSON-LD for a public profile: a schema.org Physician (a LocalBusiness) with its
 * services, languages and every clinic as a MedicalClinic location (address, map
 * point, opening hours), plus the page's BreadcrumbList. Phone numbers are left
 * out on purpose: they stay behind the reveal button.
 */

type Json = Record<string, unknown>;

export type StructuredClinic = {
  name: string;
  address: string;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHours: readonly OpeningHoursGroup[];
};

const SCHEMA_DAY: Record<DayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

function postalAddress(clinic: Pick<StructuredClinic, "address" | "district">): Json {
  const street = clinic.address.trim();
  const district = String(clinic.district ?? "").trim();
  return {
    "@type": "PostalAddress",
    ...(street ? { streetAddress: street } : {}),
    ...(district ? { addressLocality: district, addressRegion: district } : {}),
    addressCountry: "CY",
  };
}

function openingHoursSpecification(groups: readonly OpeningHoursGroup[]): Json[] {
  return groups.flatMap((group) =>
    group.ranges.map((range) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: group.days.map((day) => SCHEMA_DAY[day]),
      opens: range.open,
      closes: range.close,
    })),
  );
}

function medicalClinic(clinic: StructuredClinic): Json {
  const hours = openingHoursSpecification(clinic.openingHours);
  const hasGeo = typeof clinic.latitude === "number" && typeof clinic.longitude === "number";
  return {
    "@type": "MedicalClinic",
    name: clinic.name,
    address: postalAddress(clinic),
    ...(hasGeo
      ? { geo: { "@type": "GeoCoordinates", latitude: clinic.latitude, longitude: clinic.longitude } }
      : {}),
    ...(hours.length > 0 ? { openingHoursSpecification: hours } : {}),
  };
}

export function buildProfileStructuredData(input: {
  name: string;
  profileUrl: string;
  siteUrl: string;
  specialty: string | null;
  description: string;
  imageUrl: string | null;
  languages: readonly string[];
  services: ReadonlyArray<{ name: string; price: string | null }>;
  clinics: readonly StructuredClinic[];
  breadcrumbs: readonly ProfileBreadcrumb[];
}): Json[] {
  const primary = input.clinics[0];
  const physician: Json = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: input.name,
    url: input.profileUrl,
    ...(input.imageUrl ? { image: input.imageUrl } : {}),
    ...(input.specialty ? { medicalSpecialty: input.specialty } : {}),
    description: input.description,
    address: postalAddress(primary ?? { address: "", district: null }),
    areaServed: "Cyprus",
    ...(input.languages.length > 0 ? { knowsLanguage: [...input.languages] } : {}),
    ...(input.services.length > 0
      ? {
          availableService: input.services.map((service) => ({
            "@type": "MedicalProcedure",
            name: service.name,
          })),
        }
      : {}),
    ...(input.clinics.length > 0 ? { location: input.clinics.map(medicalClinic) } : {}),
  };

  const breadcrumbs: Json = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: input.breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      item: crumb.href ? `${input.siteUrl}${crumb.href}` : input.profileUrl,
    })),
  };

  return [physician, breadcrumbs];
}
