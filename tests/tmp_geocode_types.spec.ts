import { test } from "@playwright/test";

const SPOTS: { label: string; lat: number; lng: number }[] = [
  { label: "Tombs of the Kings Ave, Paphos", lat: 34.7810, lng: 32.4041 },
  { label: "Chlorakas, Paphos", lat: 34.7929, lng: 32.4085 },
  { label: "Anexartisias, Limassol", lat: 34.6786, lng: 33.0430 },
  { label: "Makariou III, Nicosia", lat: 35.1650, lng: 33.3540 },
  { label: "Larnaca centre", lat: 34.9182, lng: 33.6295 },
];

const STREET_LEVEL_TYPES = ["street_address", "premise", "subpremise", "route"];

test("report reverse geocode result types across Cyprus", async ({ page }) => {
  await page.goto("/register");
  await page.waitForFunction(
    () =>
      Boolean(
        (window as unknown as { google?: { maps?: { Geocoder?: unknown } } }).google?.maps
          ?.Geocoder,
      ),
    undefined,
    { timeout: 30_000 },
  );

  const report = await page.evaluate(
    async ({ spots, streetTypes }) => {
      const maps = (window as unknown as { google: { maps: Record<string, unknown> } }).google.maps;
      const GeocoderCtor = maps.Geocoder as new () => {
        geocode: (request: unknown) => Promise<{
          results: { formatted_address?: string; types?: string[] }[];
        }>;
      };
      const geocoder = new GeocoderCtor();
      const lines: string[] = [];

      for (const spot of spots) {
        try {
          const response = await geocoder.geocode({
            location: { lat: spot.lat, lng: spot.lng },
          });
          const top = response.results.slice(0, 4).map(
            (r) => `      [${(r.types ?? []).join("|")}] ${r.formatted_address ?? ""}`,
          );
          const picked = response.results.find((r) =>
            (r.types ?? []).some((t) => streetTypes.includes(t)),
          );
          lines.push(
            `  ${spot.label}\n${top.join("\n")}\n    FILTER PICKS: ${
              picked?.formatted_address ?? "*** NOTHING ***"
            }`,
          );
        } catch (error) {
          lines.push(`  ${spot.label}: ERROR ${(error as Error).message}`);
        }
      }
      return lines.join("\n");
    },
    { spots: SPOTS, streetTypes: STREET_LEVEL_TYPES },
  );

  console.log(`[types]\n${report}`);
});
