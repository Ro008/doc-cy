import { expect, type Locator, type Page } from "@playwright/test";

import type { PlacesPredictionProbe } from "./places-origin-gap";

export async function probePlacesPredictions(
  page: Page,
  query: string,
): Promise<PlacesPredictionProbe> {
  return page.evaluate(async (input) => {
    const places = window.google?.maps?.places;
    if (!places) {
      return { mapsLoaded: false, status: "NO_MAPS", count: 0 };
    }
    return await new Promise<PlacesPredictionProbe>((resolve) => {
      const finish = (result: PlacesPredictionProbe) => resolve(result);
      const timeoutId = window.setTimeout(() => {
        finish({ mapsLoaded: true, status: "CALLBACK_TIMEOUT", count: 0 });
      }, 8_000);
      try {
        const service = new places.AutocompleteService();
        service.getPlacePredictions(
          { input, componentRestrictions: { country: "cy" } },
          (predictions, status) => {
            window.clearTimeout(timeoutId);
            finish({
              mapsLoaded: true,
              status: String(status ?? "UNKNOWN"),
              count: Array.isArray(predictions) ? predictions.length : 0,
            });
          },
        );
      } catch {
        window.clearTimeout(timeoutId);
        finish({ mapsLoaded: true, status: "SERVICE_ERROR", count: 0 });
      }
    });
  }, query);
}

export async function trySelectFirstPlacesSuggestion(
  page: Page,
  clinicAddress: Locator,
): Promise<boolean> {
  const pacItem = page.locator(".pac-container .pac-item").first();
  try {
    await expect(pacItem).toBeVisible({ timeout: 20_000 });
  } catch {
    return false;
  }
  try {
    await pacItem.click({ force: true, timeout: 8_000 });
  } catch {
    await clinicAddress.press("ArrowDown");
    await clinicAddress.press("Enter");
  }
  return true;
}
