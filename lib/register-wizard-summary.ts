/** One-line recap shown on a finished /register wizard step (the collapsed accordion card). */

const SUMMARY_SEPARATOR = " · ";
const MAX_SUMMARY_LANGUAGES = 3;

export function registerAccountSummary(values: {
  firstName: string;
  lastName: string;
  email: string;
}): string {
  const name = [values.firstName, values.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  return [name, values.email.trim()].filter(Boolean).join(SUMMARY_SEPARATOR);
}

export function registerProfileSummary(values: {
  photoReady: boolean;
  languages: readonly string[];
}): string {
  const languages = values.languages.map((language) => language.trim()).filter(Boolean);
  const shown = languages.slice(0, MAX_SUMMARY_LANGUAGES).join(", ");
  const extra = languages.length - MAX_SUMMARY_LANGUAGES;
  const languageText = extra > 0 ? `${shown} +${extra}` : shown;
  return [values.photoReady ? "Photo added" : "", languageText]
    .filter(Boolean)
    .join(SUMMARY_SEPARATOR);
}
