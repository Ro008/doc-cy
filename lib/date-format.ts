import { format, isValid, parse } from "date-fns";

export function formatDateDDMMYYYY(isoDate: string): string {
  const parsed = parse(isoDate, "yyyy-MM-dd", new Date());
  if (!isValid(parsed)) return isoDate;
  return format(parsed, "dd/MM/yyyy");
}

export function parseDDMMYYYYToISO(input: string): string | null {
  const parsed = parse(input.trim(), "dd/MM/yyyy", new Date());
  if (!isValid(parsed)) return null;
  return format(parsed, "yyyy-MM-dd");
}

export function formatISOToDDMMYYYYOrEmpty(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  return formatDateDDMMYYYY(isoDate);
}

