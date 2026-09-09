import { expect, test } from "@playwright/test";

/**
 * Checks that the browser Maps key is allowed to use the geocoder.
 *
 * Reverse geocoding backs the "the pin is on a different street" suggestion in
 * the register clinic field. It needs the Geocoding API both enabled on the
 * project and listed in the key's API restrictions; missing either gives
 * REQUEST_DENIED, and the field silently falls back to a distance-only warning.
 *
 * Deliberately untagged: every CI lane greps for @pr-* tags, so this never runs
 * there. Run it by hand with `npm run diagnose:geocoding`.
 */
test("browser Maps key can use the geocoder", async ({ page }) => {
  await page.goto("/register");

  // The clinic search input loads Maps JS on mount, so no interaction needed.
  await page.waitForFunction(
    () =>
      Boolean(
        (window as unknown as { google?: { maps?: { Geocoder?: unknown } } }).google?.maps
          ?.Geocoder,
      ),
    undefined,
    { timeout: 30_000 },
  );

  const outcome = await page.evaluate(async () => {
    const maps = (window as unknown as { google: { maps: Record<string, unknown> } }).google.maps;
    const GeocoderCtor = maps.Geocoder as new () => {
      geocode: (request: unknown) => Promise<{ results: { formatted_address?: string }[] }>;
    };
    try {
      // Paphos town centre.
      const response = await new GeocoderCtor().geocode({
        location: { lat: 34.7754, lng: 32.4245 },
      });
      return { ok: true as const, first: response.results[0]?.formatted_address ?? "" };
    } catch (error) {
      return { ok: false as const, message: (error as Error).message };
    }
  });

  if (!outcome.ok) {
    console.log(`[geocoding] DENIED: ${outcome.message}`);
    console.log(
      "[geocoding] Enable Geocoding API on the project and add it to the key's API restrictions.",
    );
  } else {
    console.log(`[geocoding] OK, resolved to "${outcome.first}"`);
  }

  expect(outcome.ok, `Geocoder rejected the key: ${outcome.ok ? "" : outcome.message}`).toBe(true);
});
