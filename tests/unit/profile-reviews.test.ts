import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildRegisteredProfileMetaDescription } from "../../lib/doctor-seo-formatting";
import {
  PROFILE_HERO_RATING_MIN_REVIEWS,
  buildShareDescription,
  heroRatingFromReviews,
  PROFILE_REVIEWS_SHOWN_FIRST,
  PROFILE_REVIEWS_SHOWN_MORE,
  reviewsShownAfterMore,
  finderRatingsFromRows,
  publicReviewsFromRows,
  showHeroRating,
  summariseReviews,
} from "../../lib/public/profile-reviews";
import { PROFILE_SECTION_IDS, profileSectionTabs } from "../../lib/public/profile-sections";

/**
 * Public reviews on the profile (user, 2026-10-13): the verified reviews patients leave from the
 * emailed link (professional_reviews, written by POST /api/booking/review). The profile only
 * reads them: published ones, "Maria K." + stars + comment + date, never the email.
 */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

const row = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  rating: 5,
  comment: "Very kind and clear.",
  reviewer_name: "Maria Konstantinou",
  created_at: "2026-10-02T09:30:00.000Z",
  status: "published",
  ...over,
});

describe("publicReviewsFromRows", () => {
  it("shows first name + last initial, the rating, the comment and the date", () => {
    const [review] = publicReviewsFromRows([row()]);
    assert.deepEqual(review, {
      id: "r1",
      rating: 5,
      comment: "Very kind and clear.",
      name: "Maria K.",
      createdAt: "2026-10-02T09:30:00.000Z",
    });
  });

  it("never carries the email or the full name, even if the row has them", () => {
    const [review] = publicReviewsFromRows([
      row({ reviewer_email: "maria@example.com", reviewer_name: "Maria Konstantinou" }),
    ]);
    const text = JSON.stringify(review);
    assert.doesNotMatch(text, /maria@example\.com/);
    assert.doesNotMatch(text, /Konstantinou/);
  });

  it("leaves out hidden reviews and rows that are not a 1-5 rating with words", () => {
    const rows = publicReviewsFromRows([
      row({ id: "ok" }),
      row({ id: "hidden", status: "hidden" }),
      row({ id: "zero", rating: 0 }),
      row({ id: "six", rating: 6 }),
      row({ id: "half", rating: 4.5 }),
      row({ id: "blank", comment: "   " }),
    ]);
    assert.deepEqual(rows.map((r) => r.id), ["ok"]);
  });

  it("puts the newest first", () => {
    const rows = publicReviewsFromRows([
      row({ id: "old", created_at: "2026-09-01T10:00:00.000Z" }),
      row({ id: "new", created_at: "2026-10-05T10:00:00.000Z" }),
      row({ id: "mid", created_at: "2026-09-20T10:00:00.000Z" }),
    ]);
    assert.deepEqual(rows.map((r) => r.id), ["new", "mid", "old"]);
  });

  it("trims the comment and tolerates a null list", () => {
    assert.equal(publicReviewsFromRows([row({ comment: "  Thank you.  " })])[0].comment, "Thank you.");
    assert.deepEqual(publicReviewsFromRows(null), []);
  });
});

describe("summariseReviews", () => {
  it("counts and averages to one decimal", () => {
    const reviews = publicReviewsFromRows([
      row({ id: "a", rating: 5 }),
      row({ id: "b", rating: 4 }),
      row({ id: "c", rating: 4 }),
    ]);
    assert.deepEqual(summariseReviews(reviews), { count: 3, average: 4.3 });
  });

  it("is empty with no reviews, so the section can stay hidden", () => {
    assert.deepEqual(summariseReviews([]), { count: 0, average: null });
  });

  it("does not round a 4.96 up to a perfect 5.0", () => {
    const ratings = [...Array(24).fill(5), 4];
    const reviews = publicReviewsFromRows(ratings.map((rating, i) => row({ id: `r${i}`, rating })));
    assert.equal(summariseReviews(reviews).average, 4.9);
  });
});

describe("finderRatingsFromRows (the note on a finder card)", () => {
  const r = (professional_id: string, rating: unknown, status = "published") => ({ professional_id, rating, status });

  it("groups by professional and averages, cutting to one decimal like the profile", () => {
    const ratings = finderRatingsFromRows([
      r("a", 5), r("a", 5), r("a", 4),
      r("b", 3), r("b", 4), r("b", 4), r("b", 5),
    ]);
    assert.deepEqual(ratings.get("a"), { count: 3, average: 4.6 });
    assert.deepEqual(ratings.get("b"), { count: 4, average: 4 });
  });

  it("gives nothing below 3 reviews: the same bar as the profile hero", () => {
    const ratings = finderRatingsFromRows([r("a", 5), r("a", 5), r("c", 1)]);
    assert.equal(ratings.has("a"), false);
    assert.equal(ratings.has("c"), false);
    assert.equal(ratings.size, 0);
  });

  it("ignores hidden reviews and ratings that are not whole numbers from 1 to 5", () => {
    const ratings = finderRatingsFromRows([
      r("a", 5), r("a", 5), r("a", 5),
      r("a", 1, "hidden"), r("a", 0), r("a", 9), r("a", 2.5), r("a", "5"),
    ]);
    assert.deepEqual(ratings.get("a"), { count: 3, average: 5 });
  });

  it("tolerates a null list", () => {
    assert.equal(finderRatingsFromRows(null).size, 0);
  });
});

describe("heroRatingFromReviews", () => {
  const reviews = (ratings: number[]) =>
    publicReviewsFromRows(ratings.map((rating, i) => row({ id: `r${i}`, rating })));

  it("is the note once there are 3 reviews, and nothing before", () => {
    assert.equal(heroRatingFromReviews(reviews([])), null);
    assert.equal(heroRatingFromReviews(reviews([5, 5])), null);
    assert.deepEqual(heroRatingFromReviews(reviews([4, 3, 4])), { count: 3, average: 3.6 });
  });
});

describe("buildShareDescription (the preview of a shared profile link)", () => {
  const input = {
    doctorName: "Harrison Ford",
    specialtyForSeo: "Accident & Emergency Medicine · Biochemistry · Dentist",
    cityLabel: "Nicosia",
  };

  it("leads with the note when there are enough reviews, and says what the visitor can do", () => {
    const text = buildShareDescription({ ...input, rating: { count: 3, average: 3.6 } });
    assert.match(text, /^★ 3\.6 \(3 reviews\) · /);
    assert.match(text, /Book online with Harrison Ford in Nicosia/);
    assert.match(text, /Accident & Emergency Medicine/);
  });

  it("stays short enough that chat apps do not cut it mid-sentence", () => {
    const text = buildShareDescription({ ...input, rating: { count: 12, average: 4.9 } });
    assert.ok(text.length <= 160, `${text.length} chars: ${text}`);
    const long = buildShareDescription({
      doctorName: "Dr Alexandra Konstantinopoulou-Papadopoulou",
      specialtyForSeo: "Cardiology · Internal Medicine · Endocrinology · Sports Medicine · Dermatology",
      cityLabel: "Limassol",
      rating: { count: 100, average: 5 },
    });
    assert.ok(long.length <= 160, `${long.length} chars: ${long}`);
    assert.match(long, /^★ 5\.0 \(100 reviews\) · /);
    assert.match(long, /Konstantinopoulou-Papadopoulou/);
  });

  it("without a note it is the description the page already had", () => {
    assert.equal(
      buildShareDescription({ ...input, rating: null }),
      buildRegisteredProfileMetaDescription(input),
    );
  });

  it("is used for the shared preview only; the description Google reads is untouched", () => {
    const page = read("lib/public/doctor-profile-page.tsx");
    const meta = page.slice(page.indexOf("export async function generateMetadata"), page.indexOf("export default async function DoctorPage"));
    assert.match(meta, /const dynamicDescription = buildRegisteredProfileMetaDescription\(/);
    assert.match(meta, /description: dynamicDescription,\s*alternates/);
    assert.match(meta, /openGraph: \{[^}]*description: shareDescription/);
    assert.match(meta, /twitter: \{[^}]*description: shareDescription/);
    // The page and its metadata share one read of the reviews per request.
    assert.match(page, /const loadReviewsOnce = cache\(/);
  });
});

describe("the finder card shows the note", () => {
  it("loads ratings only for the visible registered cards, in id chunks, published only, read only", () => {
    const loader = read("lib/public/load-profile-reviews.ts");
    assert.match(loader, /export async function loadPublishedRatings\b/);
    assert.match(loader, /fetchAllSupabaseRowsForIdChunks\b/);
    assert.match(loader, /\.in\("professional_id"/);
    assert.match(loader, /\.eq\("status", "published"\)/);
    assert.doesNotMatch(loader, /reviewer_email/);
    assert.doesNotMatch(loader, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);

    const finder = read("app/finder/[[...filters]]/page.tsx");
    const visible = finder.indexOf("const visibleRegistered =");
    const load = finder.indexOf("loadPublishedRatings(");
    const card = finder.indexOf("<FinderCardRating");
    assert.ok(visible > 0 && load > visible, "loads after the page is cut to the visible cards");
    assert.ok(card > load, "the card uses what was loaded");
    assert.match(finder, /loadPublishedRatings\(\s*supabase,\s*visibleRegistered\.map/);
  });

  it("the note is a star, the average and the count, with a text alternative", () => {
    const rating = read("components/finder/FinderCardRating.tsx");
    assert.match(rating, /fill-amber-500/);
    // The finder is plain English (no next-intl there), so the alternative is written in the component.
    assert.match(rating, /out of 5 stars/);
    assert.match(rating, /aria-label/);
    assert.match(rating, /toFixed\(1\)/);
  });
});

describe("profile sections with reviews", () => {
  it("adds the Reviews tab last, after Clinics, only when there are reviews", () => {
    assert.deepEqual(
      profileSectionTabs({ hasServices: true, hasClinics: true, hasReviews: true }).map((t) => t.id),
      ["book", "about", "services", "clinics", "reviews"],
    );
    assert.deepEqual(
      profileSectionTabs({ hasServices: false, hasClinics: true, hasReviews: false }).map((t) => t.id),
      ["book", "about", "clinics"],
    );
    assert.equal(PROFILE_SECTION_IDS.reviews, "reviews");
  });
});

describe("the profile reads reviews and shows them", () => {
  it("loads only published reviews of this professional, paged past the row cap, selecting no email", () => {
    const loader = read("lib/public/load-profile-reviews.ts");
    assert.match(loader, /from\("professional_reviews"\)/);
    assert.match(loader, /\.eq\("professional_id"/);
    assert.match(loader, /\.eq\("status", "published"\)/);
    assert.match(loader, /fetchAllSupabaseRows\b/);
    assert.doesNotMatch(loader, /reviewer_email/);
    assert.doesNotMatch(loader, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
  });

  it("renders the section last, from the loaded reviews", () => {
    const page = read("lib/public/doctor-profile-page.tsx");
    const services = page.indexOf("<ProfileServicesSection");
    const reviews = page.indexOf("<ProfileReviewsSection");
    const qualifications = page.indexOf("<ProfileQualificationsSection");
    // Reviews close the page (user, 2026-10-13).
    assert.ok(services > 0 && services < qualifications && qualifications < reviews);
    assert.match(page, /loadPublishedReviews\(/);
    assert.match(page, /hasReviews:/);
  });

  it("the hero rating waits for 3 reviews: one opinion alone weighs too much up there", () => {
    assert.equal(PROFILE_HERO_RATING_MIN_REVIEWS, 3);
    assert.equal(showHeroRating(0), false);
    assert.equal(showHeroRating(2), false);
    assert.equal(showHeroRating(3), true);
    assert.equal(showHeroRating(40), true);
  });

  it("the hero links are underlined with a fine line, thicker only on hover", () => {
    const page = read("lib/public/doctor-profile-page.tsx");
    const heroLink = page.match(/const heroLinkClass =\s*"([^"]+)"/)?.[1] ?? "";
    assert.match(heroLink, /\bunderline\b/);
    assert.match(heroLink, /decoration-1\b/);
    assert.match(heroLink, /hover:decoration-2\b/);
    assert.doesNotMatch(page, /\[&_span\]:decoration-2/);
  });

  it("the hero shows five stars, the average and the count as a link to the reviews, once there are enough", () => {
    const page = read("lib/public/doctor-profile-page.tsx");
    const hero = page.indexOf('data-testid="profile-hero-rating"');
    assert.ok(hero > 0, "hero rating exists");
    assert.match(page.slice(hero - 400, hero), /showHeroRating\(reviews\.length\)/);
    const row = page.slice(hero, hero + 1200);
    // The same five stars as the Reviews section (user, 2026-10-13), with a text alternative.
    assert.match(row, /<ProfileStars\b/);
    assert.match(row, /reviewRatingLabel/);
    assert.match(row, /reviewSummary\.average\?\.toFixed\(1\)/);
    // Only the count is the link.
    assert.match(row, /<a\s+href=\{`#\$\{PROFILE_SECTION_IDS\.reviews\}`\}[\s\S]*?reviewsSummary/);
  });

  it("the hero rating has its own line, right under her name (user, 2026-10-14)", () => {
    const page = read("lib/public/doctor-profile-page.tsx");
    const name = page.indexOf("{profile.name}</h1>");
    const rating = page.indexOf('data-testid="profile-hero-rating"');
    const specialties = page.indexOf("<DoctorProfileSpecialties");
    assert.ok(name > 0 && name < rating && rating < specialties);
    // Its own row, not one more item of the facts row.
    assert.match(page, /<div\s+data-testid="profile-hero-rating"/);
  });

  it("the Reviews section and the hero draw their stars with the same component", () => {
    const section = read("components/doctor/profile/ProfileReviewsSection.tsx");
    assert.match(section, /import \{ ProfileStars \} from "@\/components\/doctor\/profile\/ProfileStars"/);
    assert.doesNotMatch(section, /function Stars\(/);
    const stars = read("components/doctor/profile/ProfileStars.tsx");
    assert.match(stars, /role="img"/);
    assert.match(stars, /fill-amber-500 text-amber-500/);
    // A star not reached is drawn in the grey text colour, so a 4-star review visibly has a
    // fifth, empty star in light and dark; the border colour vanished on the dark card
    // (1.27:1, user, 2026-10-14).
    assert.match(stars, /emptyClassName = "text-profile-muted"/);
  });

  it("the section shows the average, the count, stars with a text alternative, and the rest on request", () => {
    const section = read("components/doctor/profile/ProfileReviewsSection.tsx");
    assert.match(section, /PROFILE_SECTION_IDS\.reviews/);
    assert.match(section, /if \(reviews\.length === 0\) return null/);
    assert.match(section, /<ProfileReviewsList\b/);
    assert.match(section, /<time\b/);
    assert.match(section, /reviewRatingLabel/);
    assert.doesNotMatch(section, /dangerouslySetInnerHTML/);
    assert.ok(PROFILE_REVIEWS_SHOWN_FIRST >= 3);
  });

  it("\"Show more reviews\" opens the next 10 each time, up to the total (user, 2026-10-13)", () => {
    assert.equal(PROFILE_REVIEWS_SHOWN_MORE, 10);
    assert.equal(reviewsShownAfterMore(4, 6), 6);
    assert.equal(reviewsShownAfterMore(4, 14), 14);
    assert.equal(reviewsShownAfterMore(4, 40), 14);
    assert.equal(reviewsShownAfterMore(14, 40), 24);
    assert.equal(reviewsShownAfterMore(34, 40), 40);
    assert.equal(reviewsShownAfterMore(40, 40), 40);
  });

  it("one card of rows, like Services and Qualifications, not two columns of cards (user, 2026-10-14)", () => {
    const list = read("components/doctor/profile/ProfileReviewsList.tsx");
    assert.match(list, /divide-y divide-profile-border/);
    assert.doesNotMatch(list, /sm:grid-cols-2/);
    const section = read("components/doctor/profile/ProfileReviewsSection.tsx");
    const row = section.slice(section.indexOf('data-testid="profile-review"'), section.indexOf("</li>"));
    // A row, not a card of its own.
    assert.doesNotMatch(row, /rounded-2xl|border border-profile-border/);
    // Stars and name on the first line, the date on the right, then the comment.
    assert.ok(row.indexOf("<ProfileStars") < row.indexOf("{review.name}"));
    assert.ok(row.indexOf("{review.name}") < row.indexOf("<time"));
    assert.ok(row.indexOf("<time") < row.indexOf("{review.comment}"));
    // "Show more reviews" is the card's last row, full width with a chevron, as "Show 8 more
    // services" (user, 2026-10-14).
    assert.match(list, /text-accent-link/);
    assert.doesNotMatch(list, /rounded-full border-2/);
    assert.match(list, /<ChevronDown\b/);
    assert.match(list, /flex min-h-12 w-full items-center/);
    assert.match(list, /border-t border-profile-border/);
    assert.doesNotMatch(list, /self-start/);
  });

  it("the list has one button, only while reviews are left, and no way back to fewer", () => {
    const list = read("components/doctor/profile/ProfileReviewsList.tsx");
    assert.match(list, /^"use client";/);
    assert.match(list, /useState\(PROFILE_REVIEWS_SHOWN_FIRST\)/);
    assert.match(list, /reviewsShownAfterMore\(/);
    assert.match(list, /shown < items\.length/);
    assert.match(list, /data-testid="profile-reviews-more"/);
    assert.doesNotMatch(list, /<details/);
    const section = read("components/doctor/profile/ProfileReviewsSection.tsx");
    assert.doesNotMatch(section, /<details|reviewsShowFewer|reviewsShowAll/);
    assert.match(section, /moreLabel=\{t\("reviewsShowMore"\)\}/);
    for (const file of ["messages/en.json", "messages/el.json"]) {
      const messages = JSON.parse(read(file)).DoctorProfilePage;
      assert.equal(messages.reviewsShowFewer, undefined, file);
      assert.equal(messages.reviewsShowAll, undefined, file);
    }
    assert.equal(JSON.parse(read("messages/en.json")).DoctorProfilePage.reviewsShowMore, "Show more reviews");
  });

  it("has the copy in English and Greek", () => {
    for (const file of ["messages/en.json", "messages/el.json"]) {
      const messages = JSON.parse(read(file)).DoctorProfilePage;
      for (const key of [
        "sectionTabReviews",
        "reviewsHeading",
        "reviewsSummary",
        "reviewsVerifiedNote",
        "reviewRatingLabel",
        "reviewsShowMore",
      ]) {
        assert.equal(typeof messages[key], "string", `${file} ${key}`);
      }
    }
  });
});
