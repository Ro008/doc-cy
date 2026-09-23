import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  registerAccountSummary,
  registerProfileSummary,
} from "../../lib/register-wizard-summary";
import { registerPlanTicket } from "../../lib/register-plan-ticket";
import { REGISTER_FAQ_ITEMS } from "../../lib/register-faq";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relative: string): string {
  return fs.readFileSync(path.join(repoRoot, relative), "utf8");
}

describe("register wizard step summaries", () => {
  it("summarises the account step as name · email", () => {
    assert.equal(
      registerAccountSummary({ firstName: " Maria ", lastName: "Georgiou", email: "maria@practice.com" }),
      "Maria Georgiou · maria@practice.com",
    );
  });

  it("drops empty parts instead of leaving stray separators", () => {
    assert.equal(registerAccountSummary({ firstName: "Maria", lastName: "", email: "" }), "Maria");
    assert.equal(
      registerAccountSummary({ firstName: "", lastName: "", email: "maria@practice.com" }),
      "maria@practice.com",
    );
    assert.equal(registerAccountSummary({ firstName: "", lastName: "", email: "" }), "");
  });

  it("summarises the profile step as photo state · languages", () => {
    assert.equal(
      registerProfileSummary({ photoReady: true, languages: ["English", "Greek"] }),
      "Photo added · English, Greek",
    );
    assert.equal(registerProfileSummary({ photoReady: false, languages: ["Greek"] }), "Greek");
    assert.equal(registerProfileSummary({ photoReady: true, languages: [] }), "Photo added");
  });

  it("shortens long language lists", () => {
    assert.equal(
      registerProfileSummary({
        photoReady: true,
        languages: ["English", "Greek", "Russian", "Hebrew", "Arabic"],
      }),
      "Photo added · English, Greek, Russian +2",
    );
  });
});

describe("register plan ticket", () => {
  it("shows the Founders price with spots left while the club is open", () => {
    const ticket = registerPlanTicket({ offerAvailable: true, spotsRemaining: 17 });
    // €49 must read as the official price and €19 as a launch offer for the first 50.
    assert.equal(ticket.then.kicker, "LAUNCH OFFER · FOUNDING MEMBERS");
    assert.equal(ticket.then.price, "€19/mo");
    assert.equal(ticket.then.wasPrice, "€49/mo");
    assert.equal(ticket.then.detail, "For the first 50 practices · locked for life");
    assert.equal(ticket.then.spots, "17 spots left");
    assert.equal(ticket.then.spotsTakenPercent, 66);
    assert.equal(ticket.then.vatNote, "+VAT, if applicable");
  });

  it("says spot, not spots, when one is left", () => {
    const ticket = registerPlanTicket({ offerAvailable: true, spotsRemaining: 1 });
    assert.equal(ticket.then.spots, "1 spot left");
    assert.equal(ticket.then.spotsTakenPercent, 98);
  });

  it("falls back to standard pricing once the club is full", () => {
    const ticket = registerPlanTicket({ offerAvailable: false, spotsRemaining: 0 });
    assert.equal(ticket.then.kicker, "THEN");
    assert.equal(ticket.then.price, "€49/mo");
    assert.equal(ticket.then.wasPrice, null);
    assert.equal(ticket.then.spots, null);
    assert.equal(ticket.then.spotsTakenPercent, null);
    assert.equal(ticket.then.vatNote, "+VAT, if applicable");
  });

  it("always leads with the free profile and 6 free months of booking", () => {
    const ticket = registerPlanTicket({ offerAvailable: false, spotsRemaining: 0 });
    assert.equal(ticket.profile.price, "Free");
    assert.equal(ticket.booking.price, "6 months free");
    assert.equal(ticket.booking.detail, "No credit card");
  });
});

describe("register FAQ", () => {
  it("answers the questions professionals ask before joining", () => {
    const questions = REGISTER_FAQ_ITEMS.map((item) => item.question);
    assert.equal(REGISTER_FAQ_ITEMS.length, 7);
    assert.ok(questions.includes("Is the 6-month trial really free?"));
    assert.ok(questions.includes("Can I see bookings in my own calendar?"));
    assert.ok(questions.includes("What if the Founding Members Club is full?"));
  });

  it("never promises automatic calendar sync", () => {
    for (const item of REGISTER_FAQ_ITEMS) {
      assert.doesNotMatch(`${item.question} ${item.answer}`, /\bsync(ed|s|hroni[sz]ed?)?\b/i);
    }
    const calendar = REGISTER_FAQ_ITEMS.find((item) => /calendar/i.test(item.question));
    assert.match(calendar?.answer ?? "", /Google Calendar or Apple \/ Outlook/);
  });
});

describe("register page layout", () => {
  it("puts the wizard beside the benefits showcase, with next steps and FAQ below", () => {
    const page = read("app/register/page.tsx");
    assert.match(page, /RegisterShowcase/);
    assert.match(page, /RegisterPlanTicket/);
    assert.match(page, /RegisterNextSteps/);
    assert.match(page, /RegisterFaqSection/);
    assert.match(page, /RegisterSetupCallCard/);
    assert.match(page, /getFoundersAvailability/);
    assert.match(page, /DocCyWordmark/);
    assert.doesNotMatch(page, /RegisterSecondarySections/);
  });

  it("the showcase never claims automatic calendar sync", () => {
    const showcase = read("components/register/RegisterShowcase.tsx");
    assert.doesNotMatch(showcase, /\bsync(ed|s)?\b/i);
    assert.match(showcase, /Add to Google Calendar/);
  });

  it("the showcase autoplay respects reduced motion and pauses on hover or focus", () => {
    const showcase = read("components/register/RegisterShowcase.tsx");
    assert.match(showcase, /prefers-reduced-motion/);
    assert.match(showcase, /onMouseEnter/);
    assert.match(showcase, /onFocus/);
  });
});
