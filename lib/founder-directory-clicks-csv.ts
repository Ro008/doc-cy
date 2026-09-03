import { formatInTimeZone } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import { isTestDoctorRegistrationEmail } from "@/lib/doctor-test-profile";

export const DIRECTORY_CLICKS_CSV_HEADERS = [
  "clicked_at",
  "action",
  "name",
  "profile_url",
  "specialty",
  "district",
  "source",
] as const;

export type DirectoryClickCsvAction = "show_phone_number" | "request_online_appointment";

export type DirectoryClickCsvEvent = {
  clickedAtIso: string;
  action: DirectoryClickCsvAction;
  name: string | null;
  slug: string | null;
  specialty: string | null;
  district: string | null;
  source: string | null;
  isTestProfile?: boolean | null;
  email?: string | null;
};

export function formatCyprusClickTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatInTimeZone(d, CY_TZ, "yyyy-MM-dd HH:mm:ss");
}

export function directoryClickProfileUrl(slug: string | null | undefined, siteBaseUrl: string): string {
  const path = publicProfessionalProfilePath(String(slug ?? "").trim());
  if (!String(slug ?? "").trim()) return "";
  const base = String(siteBaseUrl ?? "").replace(/\/$/, "");
  return `${base}${path}`;
}

export function shouldOmitDirectoryClickFromCsv(event: DirectoryClickCsvEvent): boolean {
  if (event.isTestProfile === true) return true;
  if (isTestDoctorRegistrationEmail(event.email)) return true;
  if (!String(event.name ?? "").trim() && !String(event.slug ?? "").trim()) return true;
  return false;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function toDirectoryClickCsvLine(
  event: DirectoryClickCsvEvent,
  siteBaseUrl: string,
): string[] | null {
  if (shouldOmitDirectoryClickFromCsv(event)) return null;
  return [
    formatCyprusClickTimestamp(event.clickedAtIso),
    event.action,
    String(event.name ?? "").trim(),
    directoryClickProfileUrl(event.slug, siteBaseUrl),
    String(event.specialty ?? "").trim(),
    String(event.district ?? "").trim(),
    String(event.source ?? "").trim(),
  ];
}

export function serializeDirectoryClicksCsv(
  events: readonly DirectoryClickCsvEvent[],
  siteBaseUrl: string,
): string {
  const lines = [
    DIRECTORY_CLICKS_CSV_HEADERS.join(","),
    ...events
      .map((event) => toDirectoryClickCsvLine(event, siteBaseUrl))
      .filter((row): row is string[] => row !== null)
      .map((row) => row.map(csvEscape).join(",")),
  ];
  return `\uFEFF${lines.join("\n")}\n`;
}

export function directoryClicksCsvFilename(params: {
  action?: DirectoryClickCsvAction | null;
  callToBookRange: string;
  manualVotesRange: string;
}): string {
  if (params.action === "show_phone_number") {
    return `doccy-show-phone-clicks-${params.callToBookRange}.csv`;
  }
  if (params.action === "request_online_appointment") {
    return `doccy-request-online-clicks-${params.manualVotesRange}.csv`;
  }
  return `doccy-directory-clicks-phone-${params.callToBookRange}-booking-${params.manualVotesRange}.csv`;
}
