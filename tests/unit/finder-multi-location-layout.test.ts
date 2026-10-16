import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  finderMultiLocationDividerClass,
  finderMultiLocationRowClass,
} from "../../components/finder/finder-availability-layout";
import { manualPreviewSeedKey } from "../../lib/finder-manual-preview-calendar";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("finder multi-location layout", () => {
  it("only draws a grey divider after the first practice location", () => {
    assert.equal(finderMultiLocationRowClass(0), undefined);
    assert.equal(finderMultiLocationRowClass(1), finderMultiLocationDividerClass);
    assert.equal(finderMultiLocationRowClass(2), finderMultiLocationDividerClass);
    assert.match(finderMultiLocationDividerClass, /border-t/);
    assert.match(finderMultiLocationDividerClass, /border-site-ink-200/);
  });

  it("seeds distinct preview calendars per location without changing a single-location listing", () => {
    assert.equal(manualPreviewSeedKey("listing-1", null), "listing-1");
    assert.equal(manualPreviewSeedKey("listing-1", ""), "listing-1");
    assert.equal(manualPreviewSeedKey("listing-1", "clinic-a"), "listing-1:clinic-a");
  });

  it("uses the shared layout for registered and manual finder cards", () => {
    const page = fs.readFileSync(
      path.join(repoRoot, "app/finder/[[...filters]]/page.tsx"),
      "utf8",
    );
    const landing = fs.readFileSync(
      path.join(repoRoot, "components/finder/ManualDirectoryLandingCard.tsx"),
      "utf8",
    );
    const layout = fs.readFileSync(
      path.join(repoRoot, "components/finder/FinderMultiLocationAvailability.tsx"),
      "utf8",
    );
    const manual = fs.readFileSync(
      path.join(repoRoot, "components/finder/FinderManualLocationCalendars.tsx"),
      "utf8",
    );
    const registered = fs.readFileSync(
      path.join(repoRoot, "components/finder/FinderRegisteredCardAvailability.tsx"),
      "utf8",
    );

    // Mockup L: the card opens with the profile's hero (languages as words, specialty pills).
    assert.equal(page.includes("finderCardLanguagesText"), true);
    assert.equal(page.includes("<FinderProfileCardHero"), true);
    assert.equal(page.includes("FinderRegisteredCardAvailability"), true);
    assert.equal(page.includes("FinderRegisteredPublicCall"), true);
    assert.equal(page.includes("FinderManualLocationCalendars"), true);
    assert.equal(registered.includes('kind="clinic"'), true);
    assert.equal(registered.includes('variant="show-phone-number"'), true);
    assert.equal(registered.includes('variant="profile-call"'), false);
    assert.equal(registered.includes("tel:"), false);
    assert.equal(registered.includes("call-to-book"), false);
    assert.equal(landing.includes("FinderManualLocationCalendars"), true);
    assert.equal(landing.includes('layoutVariant="landing"'), true);
    assert.equal(layout.includes("FINDER_LOCATION_CALENDAR_DIVIDER_TEST_ID"), true);
    assert.equal(layout.includes("finderMultiLocationRowClass"), true);
    assert.equal(manual.includes('"use client"'), false);
    assert.equal(manual.includes("FinderMultiLocationAvailability"), true);
  });

  it("keeps a fixed slot-grid height (scrolls, doesn't grow) while the identity column can still grow", () => {
    const tokens = fs.readFileSync(
      path.join(repoRoot, "components/finder/finder-availability-layout.ts"),
      "utf8",
    );
    const slotGrid = fs.readFileSync(
      path.join(repoRoot, "components/finder/FinderAvailabilityDaySlotGrid.tsx"),
      "utf8",
    );
    const registeredGrid = fs.readFileSync(
      path.join(repoRoot, "components/finder/FinderCardAvailabilityGrid.tsx"),
      "utf8",
    );
    const surface = fs.readFileSync(
      path.join(repoRoot, "components/finder/finder-surface.ts"),
      "utf8",
    );

    assert.equal(tokens.includes("sm:items-start"), true);
    assert.equal(tokens.includes("sm:items-stretch"), false);
    assert.equal(tokens.includes("grid items-start gap-5"), true);
    // Every card the same size (user, 2026-10-15): the collapsed slot grid has a fixed
    // height on every screen; opened, it grows (and scrolls past ~6 rows on desktop).
    assert.match(tokens, /finderCardSlotGridCollapsedClass =\s*"h-\[190px\] overflow-hidden lg:h-\[180px\] lg:overflow-y-auto"/);
    assert.match(tokens, /finderCardSlotGridExpandedClass = "lg:max-h-\[282px\] lg:overflow-y-auto"/);
    assert.equal(slotGrid.includes("finderCardSlotGridCollapsedClass"), true);
    assert.equal(slotGrid.includes("finderCardSlotGridExpandedClass"), true);
    assert.equal(slotGrid.includes("flex-1"), false);
    // The calendar area is one box whatever it holds, so paused and preview cards match.
    assert.match(tokens, /finderCardCalendarBoxClass =\s*"flex min-h-\[233px\] flex-col lg:min-h-\[227px\] \[&>\*\]:flex-1"/);
    assert.equal(registeredGrid.includes("overflow-hidden rounded-lg"), true);
    assert.equal(surface.includes("h-auto overflow-visible"), true);
  });
});
