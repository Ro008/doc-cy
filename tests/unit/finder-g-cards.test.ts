import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) =>
  fs.readFileSync(path.join(repoRoot, file), "utf8").replace(/\r\n/g, "\n");

const page = read("app/finder/[[...filters]]/page.tsx");
const hero = read("components/finder/FinderProfileCardHero.tsx");
const registered = read("components/finder/FinderRegisteredCardAvailability.tsx");
const strip = read("components/finder/FinderCardDayStrip.tsx");
const week = read("components/finder/FinderCardWeek.tsx");
const shell = read("components/finder/FinderResultsAvailabilityShell.tsx");
const clinicColumn = read("components/finder/FinderCardClinicColumn.tsx");
const listing = read("components/finder/FinderManualLocationCalendars.tsx");
const box = read("components/finder/FinderListingRequestBox.tsx");
const noBooking = read("components/finder/FinderCardNoOnlineBooking.tsx");
const reviews = read("components/finder/FinderCardReviewsButton.tsx");
const layout = read("components/finder/finder-availability-layout.ts");

describe("the card as a summary of her profile (mockup L; user, 2026-10-16)", () => {
  it("every card, registered or listing, opens with the profile's hero", () => {
    assert.equal((page.match(/<FinderProfileCardHero\b/g) ?? []).length, 2, "registered + listing");
  });

  it("the hero is a quiet panel, not the teal band (mockup O; user, 2026-10-16)", () => {
    assert.equal(/bg-accent\b/.test(hero), false, "no teal band");
    assert.equal(hero.includes("text-accent-on"), false);
    assert.match(hero, /bg-\[#EEF6F7\]/);
    assert.match(hero, /\[\.doccy-profile\[data-scheme=dark\]_&\]:bg-\[#17335A\]/);
    // The star in amber so the rating is easy to find.
    assert.match(hero, /text-\[#B45309\]/);
    assert.match(hero, /\[\.doccy-profile\[data-scheme=dark\]_&\]:text-\[#FBBF24\]/);
    // Teal only in small things: outlined specialty pills.
    assert.match(hero, /border-\[#BFE0E3\]/);
    for (const [name, source] of [
      ["reviews", read("components/finder/FinderCardReviewsButton.tsx")],
      ["mobile", read("components/finder/FinderCardHeroMobile.tsx")],
    ] as const) {
      assert.equal(source.includes("text-accent-on"), false, name);
      assert.match(source, /text-accent-link/, name);
    }
  });

  it("from lg the profile is a side panel on the left of each card (mockup O)", () => {
    assert.match(layout, /finderProfileCardClass =[^;]*lg:grid-cols-\[300px_minmax\(0,1fr\)\]/);
    // Claim + Report at the bottom of the card from lg (user, 2026-10-16): the body and the
    // clinic column stretch to the card's height and the footer takes the space above it.
    assert.match(layout, /finderProfileCardBodyClass =[^;]*lg:self-stretch/);
    const clinic = read("components/finder/FinderCardClinicColumn.tsx");
    assert.match(clinic, /lg:self-stretch/);
    assert.match(clinic, /className="[^"]*lg:mt-auto[^"]*" data-testid="finder-listing-footer"/);
    // One height from lg, sized for the fullest card (a three-line name beside the photo).
    assert.match(layout, /finderProfileCardClass =[^;]*lg:min-h-\[352px\]/);
    assert.match(layout, /finderProfileCardBodyClass =[^;]*lg:grid-cols-\[minmax\(0,1fr\)_300px\]/);
    assert.match(hero, /lg:grid-cols-\[72px_minmax\(0,1fr\)\]/);
    assert.match(hero, /lg:col-span-2 lg:col-start-1/);
    assert.match(hero, /lg:flex-col/);
  });

  it("cards stand apart: a firmer edge, a soft shadow, more room between them (mockup O)", () => {
    assert.match(layout, /finderProfileCardClass =[^;]*border-\[#D3E2E6\]/);
    assert.match(layout, /finderProfileCardClass =[^;]*\[\.doccy-profile\[data-scheme=dark\]_&\]:border-\[#2A4370\]/);
    assert.match(page, /<div className="flex flex-col gap-7">/);
    assert.match(page, /<main className="min-h-screen bg-\[#ECF2F4\] text-site-ink-800 \[\.doccy-profile\[data-scheme=dark\]_&\]:bg-\[#071122\]">/);
  });

  it("the hero: name, rating with the reviews link, specialty pills with GeSY, the facts", () => {
    assert.match(hero, /<FinderSpecialtyLink\b/);
    // The colour mark on the pale panel; it swaps to its white-text copy in dark.
    assert.match(hero, /<GesyProviderBadge\b/);
    assert.equal(/<GesyProviderBadge[^>]*variant="mono"/.test(hero), false);
    assert.match(hero, /Speaks \{languages\}/);
    assert.match(hero, /patientsSeen/);
    assert.match(hero, /<FinderCardReviewsButton\b/);
    // No headline on the card (user, 2026-10-16).
    assert.equal(hero.includes("headline"), false);
  });

  it("Show mobile sits in the hero, only for professionals who show it on their profile", () => {
    assert.match(page, /<FinderCardHeroMobile\b/);
    const mobile = read("components/finder/FinderCardHeroMobile.tsx");
    assert.match(mobile, /loadFinderPersonalMobileIds\(doctorIdsKey\)/);
    assert.match(mobile, /label="Show mobile"/);
    assert.match(mobile, /source="finder_card"/);
    assert.equal(/\bmobile_number\b/.test(mobile), false, "fetched on the click, never in the page");
  });

  it("listings and professionals without a photo get the default male / female avatar", () => {
    assert.match(page, /resolveFinderDisplayPhotoUrl\(\{\s*curatedOrCustomPhotoUrl: toPublicAvatarUrl\(raw\.avatar_url\)/);
  });

  it("who she sees comes from her profile", () => {
    assert.match(page, /patients_seen/);
    assert.match(page, /finderCardPatientsSeenText\(/);
  });

  it("the reviews link opens her reviews over the Finder", () => {
    assert.match(reviews, /role="dialog"/);
    assert.match(reviews, /\/api\/directory\/professional-reviews/);
    const route = read("app/api/directory/professional-reviews/route.ts");
    assert.match(route, /loadPublishedReviews\(/);
    assert.match(route, /is_registered/);
    assert.match(route, /createServiceRoleClient\(\{ fresh: true \}\)/);
  });
});

describe("the clinic, as on the profile", () => {
  it("name, address, opening hours, then Call and Open in Maps", () => {
    assert.match(clinicColumn, /Building2/);
    assert.match(clinicColumn, /Clock/);
    assert.match(clinicColumn, /hours\.map\(/);
    assert.match(clinicColumn, /label="Call"/);
    assert.match(clinicColumn, /Open in Maps/);
    assert.match(clinicColumn, /source="finder_card"/);
    assert.match(registered, /finderCardOpeningHours\(location\)/);
  });

  it("Claim and Report sit under a listing's clinic", () => {
    assert.match(clinicColumn, /footer/);
    assert.match(listing, /footer=\{footer\}/);
    assert.equal(box.includes("footer"), false);
  });
});

describe("the week", () => {
  it("seven days on the Finder, the chosen day shared by every card", () => {
    assert.match(page, /<FinderResultsAvailabilityShell dayHeaders=\{finderAvailabilityDayHeaders\} dayCount=\{FINDER_DAY_STRIP_DAY_COUNT\}>/);
    assert.match(shell, /selectedDayIndex/);
    assert.match(shell, /selectDay:/);
    assert.match(shell, /setSelectedDayIndex\(next\)/);
  });

  it("each circle is a button that says its day and whether it has times", () => {
    assert.match(week, /finderDayStripCircles\(/);
    assert.match(week, /aria-pressed=\{/);
    assert.match(week, /no times/);
    assert.match(week, /aria-label="Earlier days, every card"/);
    assert.match(week, /aria-label="Later days, every card"/);
  });

  it("every kind of card shows the week: grey where there is no online booking", () => {
    for (const [name, source] of [
      ["times", strip],
      ["not available", noBooking],
      ["listing", box],
    ] as const) {
      assert.match(source, /<FinderCardWeek\b/, name);
    }
  });

  it("under it: the chosen day's times, All times, or the next free day", () => {
    assert.match(strip, /finderDayStripLongDate\(/);
    assert.match(strip, /buildDoctorBookingHref\(profileSlug, slot\.slotKey, locationId\)/);
    assert.match(strip, />\s*All times\s*</);
    assert.match(strip, /No times this day\./);
    assert.match(strip, /Next free: \{finderDayStripShortDate\(/);
    assert.match(registered, /<FinderCardDayStrip\b/);
  });

  it("the times area is one height on every card from lg", () => {
    assert.match(layout, /export const finderCardTimesAreaClass/);
    for (const [name, source] of [
      ["times", strip],
      ["not available", noBooking],
      ["listing", box],
    ] as const) {
      assert.match(source, /finderCardTimesAreaClass/, name);
    }
  });
});

describe("no online booking here", () => {
  it("a paused clinic and an ended subscription read the same", () => {
    assert.match(noBooking, /FINDER_CARD_NO_ONLINE_BOOKING\.title/);
    assert.match(noBooking, /FINDER_CARD_NO_ONLINE_BOOKING\.body/);
    assert.match(registered, /<FinderCardNoOnlineBooking\b/);
  });

  it("a listing asks: heading, the count, the button, the reassurance line", () => {
    assert.match(box, /Want to book an appointment online\?/);
    assert.match(box, /finderCardRequestCountText\(requestCount\)/);
    assert.match(box, /REQUEST_ONLINE_BOOKING_BUTTON_LABEL/);
    assert.match(box, /Takes 1 second\. No account needed\./);
    assert.match(box, /FINDER_MANUAL_REQUEST_ATTR/);
    assert.match(box, /data-testid="finder-manual-request-online-booking"/);
    // The arrow came off the button (user, 2026-10-16).
    assert.equal(box.includes("ArrowRight"), false);
    assert.match(listing, /<FinderListingRequestBox\b/);
  });

  it("no blurred calendar of invented times on a finder card", () => {
    const finderBranch = listing.slice(listing.indexOf('if (layoutVariant === "finder")'));
    assert.ok(finderBranch.length > 0);
    assert.equal(finderBranch.slice(0, finderBranch.indexOf("\n  }\n")).includes("FinderManualCardAvailabilityGrid"), false);
  });
});
