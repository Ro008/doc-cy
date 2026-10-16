import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) =>
  fs.readFileSync(path.join(repoRoot, file), "utf8").replace(/\r\n/g, "\n");

const page = read("app/finder/[[...filters]]/page.tsx");
const registered = read("components/finder/FinderRegisteredCardAvailability.tsx");
const strip = read("components/finder/FinderCardDayStrip.tsx");
const shell = read("components/finder/FinderResultsAvailabilityShell.tsx");
const clinicColumn = read("components/finder/FinderCardClinicColumn.tsx");
const listing = read("components/finder/FinderManualLocationCalendars.tsx");
const layout = read("components/finder/finder-availability-layout.ts");

describe("G's card top (Finder G, step 4; user, 2026-10-16)", () => {
  it("one grid: who, where, then the calendar across the card", () => {
    assert.ok(layout.includes("export const finderGCardGridClass"));
    assert.equal((page.match(/className=\{finderGCardGridClass\}/g) ?? []).length, 2, "registered + listing");
  });

  it("specialties as one line of links, languages as words: no pills, no 'Speaks'", () => {
    assert.equal(page.includes("<FinderSpecialtyPills"), false);
    assert.equal(page.includes("<FinderCardLanguages"), false);
    assert.equal((page.match(/<FinderCardSpecialtyLine\b/g) ?? []).length, 2);
    assert.match(page, /finderCardLanguagesText\(row\.languages\)/);
  });

  it("the clinic column: name, address, Open in Maps · Clinic phone · Mobile Number", () => {
    assert.match(clinicColumn, /Open in Maps/);
    assert.match(clinicColumn, /label="Clinic phone"/);
    assert.match(clinicColumn, /label="Mobile Number"/);
    assert.match(clinicColumn, /source="finder_card"/);
    assert.match(clinicColumn, /<RevealMobileButton\b/);
    // The number is fetched on the click, never in the page.
    assert.equal(clinicColumn.includes("mobile_number"), false);
  });

  it("Mobile Number only for professionals who show it on their profile", () => {
    assert.match(registered, /loadFinderPersonalMobileIds\(doctorIdsKey\)/);
    assert.match(registered, /mobileProfessionalId=\{mobileIds\.has\(doctorId\) \? doctorId : null\}/);
  });
});

describe("G's day circles", () => {
  it("seven days on the Finder, the chosen day shared by every card", () => {
    assert.match(page, /<FinderResultsAvailabilityShell dayHeaders=\{finderAvailabilityDayHeaders\} dayCount=\{FINDER_DAY_STRIP_DAY_COUNT\}>/);
    assert.match(shell, /selectedDayIndex/);
    assert.match(shell, /selectDay:/);
  });

  it("an arrow moves every card a week and chooses its first day", () => {
    assert.match(shell, /setSelectedDayIndex\(next\)/);
  });

  it("each circle is a button that says its day and whether it has times", () => {
    assert.match(strip, /finderDayStripCircles\(/);
    assert.match(strip, /aria-pressed=\{/);
    assert.match(strip, /no times/);
    assert.match(strip, /aria-label="Earlier days, every card"/);
    assert.match(strip, /aria-label="Later days, every card"/);
  });

  it("under them: the chosen day's times, All times, or the next free day", () => {
    assert.match(strip, /finderDayStripLongDate\(/);
    assert.match(strip, /buildDoctorBookingHref\(profileSlug, slot\.slotKey, locationId\)/);
    assert.match(strip, />\s*All times\s*</);
    assert.match(strip, /No times this day\./);
    assert.match(strip, /Next free: \{finderDayStripShortDate\(/);
  });

  it("the registered card uses it instead of the old grid", () => {
    assert.match(registered, /<FinderCardDayStrip\b/);
    assert.equal(registered.includes("FinderCardAvailabilityGrid"), false);
  });
});

describe("paused clinic and listings, as in G", () => {
  it("a paused clinic names where she books online", () => {
    const paused = read("components/finder/FinderCardOnlineBookingPaused.tsx");
    assert.match(paused, /Online booking is paused at this clinic/);
    assert.match(paused, /Online booking is open at \{openClinicName\}/);
    assert.match(registered, /openClinicName=\{/);
  });

  it("a listing keeps the old request wording and asks for votes (user, 2026-10-16)", () => {
    const box = read("components/finder/FinderListingRequestBox.tsx");
    assert.ok(box.includes("formatFinderRequestBadgeLabel(requestCount)"));
    assert.ok(box.includes("Want to book an appointment online?"));
    assert.ok(box.includes("This professional hasn&apos;t activated online booking yet."));
    assert.ok(box.includes("Takes 1 second. No account needed."));
    assert.ok(box.includes("{footer}"));
    assert.match(box, /FINDER_MANUAL_REQUEST_ATTR/);
    assert.match(box, /data-testid="finder-manual-request-online-booking"/);
    assert.match(listing, /<FinderListingRequestBox\b/);
  });

  it("no blurred calendar of invented times on a finder card", () => {
    const finderBranch = listing.slice(listing.indexOf('if (layoutVariant === "finder")'));
    assert.ok(finderBranch.length > 0);
    assert.equal(finderBranch.slice(0, finderBranch.indexOf("\n  }\n")).includes("FinderManualCardAvailabilityGrid"), false);
  });

  it("every card's calendar area is one size, whatever it holds", () => {
    for (const [name, source] of [
      ["day strip", strip],
      ["paused", read("components/finder/FinderCardOnlineBookingPaused.tsx")],
      ["listing", read("components/finder/FinderListingRequestBox.tsx")],
      ["skeleton", registered],
    ] as const) {
      assert.match(source, /finderCardCalendarAreaClass/, name);
    }
  });
});
