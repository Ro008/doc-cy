import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { promoteBookingNotice } from "../../lib/promote-booking-notice";
import { resolvePromotePracticeCopy } from "../../lib/promote-practice-copy";
import {
  buildReceptionScriptText,
  buildShareMessage,
  buildTelegramShareUrl,
  buildViberShareUrl,
  buildVoicemailScriptText,
  buildWhatsAppShareUrl,
  parsePromoteLanguage,
} from "../../lib/promote-practice-script-templates";

/**
 * Promote (user, 2026-10-11): she picks the language of the sign and scripts; the
 * voicemail names her instead of spelling a long address; the reception script is
 * spoken by her team, not by her; the link can be shared on WhatsApp and Viber; a
 * notice warns when patients who follow the link cannot book; DocCy no longer offers
 * to add the button to her website.
 */

const who = { name: "Maria Merakli", siteHost: "mydoccy.com" };
const url = "https://www.mydoccy.com/maria-merakli";

describe("the language of the sign and scripts", () => {
  it("is English unless Greek is chosen", () => {
    assert.equal(parsePromoteLanguage("el"), "el");
    assert.equal(parsePromoteLanguage("en"), "en");
    assert.equal(parsePromoteLanguage(null), "en");
    assert.equal(parsePromoteLanguage("fr"), "en");
  });
});

describe("the voicemail script", () => {
  it("names her and the site instead of reading out the address", () => {
    const text = buildVoicemailScriptText("en", who);
    assert.match(text, /search for Maria Merakli on mydoccy\.com/);
    assert.ok(!text.includes("mydoccy.com/"));
    assert.ok(!text.includes("https://"));
  });

  it("does the same in Greek", () => {
    const text = buildVoicemailScriptText("el", who);
    assert.match(text, /αναζητήστε «Maria Merakli» στο mydoccy\.com/);
    assert.ok(!text.includes("mydoccy.com/"));
  });
});

describe("the reception script", () => {
  it("is spoken by her team: her name, not 'my'", () => {
    const text = buildReceptionScriptText("en", { name: who.name, bookingUrl: url });
    assert.match(text, /Maria Merakli's available times/);
    assert.ok(!/\bmy available\b/.test(text));
    assert.ok(text.includes(url));
  });

  it("names her in Greek too", () => {
    const text = buildReceptionScriptText("el", { name: who.name, bookingUrl: url });
    assert.ok(text.includes("Maria Merakli"));
    assert.ok(text.includes(url));
  });
});

describe("sharing the link", () => {
  it("writes a short message with her name and the link", () => {
    assert.equal(
      buildShareMessage("en", who.name, url),
      `Book an appointment with Maria Merakli online: ${url}`,
    );
    assert.ok(buildShareMessage("el", who.name, url).endsWith(url));
    assert.ok(buildShareMessage("el", who.name, url).includes("Maria Merakli"));
  });

  it("opens WhatsApp and Viber with the message filled in", () => {
    const text = buildShareMessage("en", who.name, url);
    assert.equal(buildWhatsAppShareUrl(text), `https://wa.me/?text=${encodeURIComponent(text)}`);
    assert.equal(buildViberShareUrl(text), `viber://forward?text=${encodeURIComponent(text)}`);
  });
});

describe("sharing on Telegram", () => {
  it("passes the link and the sentence separately, as Telegram expects", () => {
    assert.equal(
      buildTelegramShareUrl("en", who.name, url),
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent("Book an appointment with Maria Merakli online")}`,
    );
    assert.ok(buildTelegramShareUrl("el", who.name, url).includes(encodeURIComponent("Κλείστε ραντεβού online με Maria Merakli")));
  });
});

describe("the printed sign's steps", () => {
  it("say she confirms, not that the time is booked at once", () => {
    const en = resolvePromotePracticeCopy("en");
    assert.deepEqual(
      [en.signStepScan, en.signStepPick, en.signStepConfirm],
      ["Scan the code", "Choose a time", "We confirm by email"],
    );
    const el = resolvePromotePracticeCopy("el");
    assert.equal(el.signStepConfirm, "Επιβεβαιώνουμε με email");
  });
});

describe("the website button", () => {
  it("no longer offers that DocCy adds it", () => {
    for (const lang of ["en", "el"]) {
      const copy = resolvePromotePracticeCopy(lang) as Record<string, string>;
      assert.equal(copy.websiteFreeHelp, undefined);
      assert.equal(copy.websiteFreeHelpNote, undefined);
      assert.equal(copy.websiteContactSupport, undefined);
      assert.ok(!/rebuild|ξαναφτιάχνουμε/.test(copy.websiteHint));
    }
  });
});

describe("promoteBookingNotice", () => {
  const open = {
    accessEnded: false,
    holidayActive: false,
    holidayEnd: "",
    clinics: [{ paused: false }, { paused: true }],
  };

  it("says nothing while patients can book", () => {
    assert.equal(promoteBookingNotice(open), null);
  });

  it("warns when her access has ended, before anything else", () => {
    const notice = promoteBookingNotice({ ...open, accessEnded: true, holidayActive: true, holidayEnd: "20/10/2026" });
    assert.equal(notice?.section, "plan");
    assert.match(notice!.text, /access has ended/);
    assert.equal(notice?.linkLabel, "See your plan");
  });

  it("warns during holiday mode, with the last day", () => {
    const notice = promoteBookingNotice({ ...open, holidayActive: true, holidayEnd: "20/10/2026" });
    assert.equal(notice?.section, "clinics");
    assert.equal(
      notice?.text,
      "Holiday mode is on until 20/10/2026, so patients who scan your sign or open your link cannot book online until then.",
    );
  });

  it("warns when online booking is paused at every clinic", () => {
    const notice = promoteBookingNotice({ ...open, clinics: [{ paused: true }, { paused: true }] });
    assert.equal(notice?.section, "clinics");
    assert.match(notice!.text, /paused at every clinic/);
    assert.equal(notice?.linkLabel, "Open Clinics");
  });

  it("uses the singular for one paused clinic", () => {
    const notice = promoteBookingNotice({ ...open, clinics: [{ paused: true }] });
    assert.match(notice!.text, /paused at your clinic/);
  });

  it("says nothing without clinics", () => {
    assert.equal(promoteBookingNotice({ ...open, clinics: [] }), null);
  });
});
