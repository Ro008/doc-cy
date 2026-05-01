import {defineRouting} from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "el"],
  defaultLocale: "en",
  // For now, patient-facing public URLs should be localized.
  localePrefix: "always",
  // Keep locale deterministic; do not auto-switch from browser/cookie.
  localeDetection: false,
});

