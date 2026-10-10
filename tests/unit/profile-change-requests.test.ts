import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildProfileChangeApprovedEmail,
  buildProfileChangeDeniedEmail,
  buildProfileChangeNotifyContent,
} from "../../lib/profile-change-emails";
import {
  NAME_CHANGE_REQUEST_TYPE,
  PHOTO_CHANGE_REQUEST_TYPE,
  pickNameChangeSlug,
  profileChangeDbErrorMessage,
  profileChangeRequestDate,
  profileChangeState,
  reviewedNameChange,
  type ProfileChangeRow,
} from "../../lib/profile-change-requests";

/**
 * The professional's name and photo change by request (user, 2026-10-10): founders
 * approve or deny, she can withdraw while it is open, and Settings shows where the
 * request stands.
 */

const row = (over: Partial<ProfileChangeRow>): ProfileChangeRow => ({
  id: "r1",
  request_type: NAME_CHANGE_REQUEST_TYPE,
  status: "pending",
  details: { name: "Maria New", reason: null },
  created_at: "2026-10-10T08:00:00Z",
  decided_at: null,
  decision_note: null,
  ...over,
});

describe("profileChangeState", () => {
  it("has nothing to show without requests", () => {
    assert.deepEqual(profileChangeState([], NAME_CHANGE_REQUEST_TYPE), { pending: null, denied: null });
  });

  it("shows the open request with what she asked and when", () => {
    assert.deepEqual(profileChangeState([row({})], NAME_CHANGE_REQUEST_TYPE), {
      pending: { id: "r1", createdAt: "2026-10-10T08:00:00Z", name: "Maria New", photoPath: null },
      denied: null,
    });
  });

  it("shows the reason when her latest request was denied", () => {
    const rows = [
      row({ id: "r2", status: "rejected", decided_at: "2026-10-11T09:00:00Z", decision_note: "Not on your licence." }),
      row({ id: "r1", status: "approved", created_at: "2026-09-01T08:00:00Z", decided_at: "2026-09-02T08:00:00Z" }),
    ];
    assert.deepEqual(profileChangeState(rows, NAME_CHANGE_REQUEST_TYPE).denied, {
      id: "r2",
      decidedAt: "2026-10-11T09:00:00Z",
      reason: "Not on your licence.",
      name: "Maria New",
    });
  });

  it("drops an old denial once she sends, withdraws or wins a newer request", () => {
    const denied = row({ id: "r1", status: "rejected", created_at: "2026-09-01T08:00:00Z", decision_note: "No." });
    for (const status of ["pending", "withdrawn", "approved"] as const) {
      const state = profileChangeState([row({ id: "r2", status }), denied], NAME_CHANGE_REQUEST_TYPE);
      assert.equal(state.denied, null, status);
    }
  });

  it("keeps the kinds apart, whatever order the rows come in", () => {
    const rows = [
      row({ id: "n-old", status: "withdrawn", created_at: "2026-10-01T08:00:00Z" }),
      row({ id: "p1", request_type: PHOTO_CHANGE_REQUEST_TYPE, details: { photo_path: "a/b.jpg" } }),
      row({ id: "n-new", created_at: "2026-10-09T08:00:00Z" }),
    ];
    assert.equal(profileChangeState(rows, NAME_CHANGE_REQUEST_TYPE).pending?.id, "n-new");
    assert.deepEqual(profileChangeState(rows, PHOTO_CHANGE_REQUEST_TYPE).pending, {
      id: "p1",
      createdAt: "2026-10-10T08:00:00Z",
      name: null,
      photoPath: "a/b.jpg",
    });
  });
});

describe("profileChangeRequestDate", () => {
  it("is day/month/year in Cyprus time", () => {
    assert.equal(profileChangeRequestDate("2026-10-10T08:00:00Z"), "10/10/2026");
    // 22:30 UTC is already the next day in Cyprus.
    assert.equal(profileChangeRequestDate("2026-03-05T22:30:00Z"), "06/03/2026");
    assert.equal(profileChangeRequestDate("nonsense"), "");
  });
});

describe("pickNameChangeSlug", () => {
  const base = { district: null, authUserId: "11111111-2222-3333-4444-555555555555" };

  it("takes the new name's address when it is free", () => {
    assert.equal(
      pickNameChangeSlug({ ...base, name: "Maria Georgiou", currentSlug: "maria-ioannou", taken: new Set() }),
      "maria-georgiou",
    );
  });

  it("keeps her address when it still fits the new name", () => {
    // Only the spelling changed, or she already had a numbered address for that name.
    assert.equal(
      pickNameChangeSlug({ ...base, name: "María Ioánnou", currentSlug: "maria-ioannou", taken: new Set(["maria-ioannou"]) }),
      "maria-ioannou",
    );
    assert.equal(
      pickNameChangeSlug({ ...base, name: "Maria Ioannou", currentSlug: "maria-ioannou-2", taken: new Set() }),
      "maria-ioannou-2",
    );
  });

  it("skips addresses other profiles use or that still forward to them", () => {
    assert.equal(
      pickNameChangeSlug({
        ...base,
        name: "Maria Georgiou",
        currentSlug: "maria-ioannou",
        taken: new Set(["maria-georgiou", "maria-georgiou-2"]),
      }),
      "maria-georgiou-3",
    );
  });

  it("tries the district before numbers", () => {
    assert.equal(
      pickNameChangeSlug({
        ...base,
        district: "Paphos",
        name: "Maria Georgiou",
        currentSlug: "maria-ioannou",
        taken: new Set(["maria-georgiou"]),
      }),
      "maria-georgiou-paphos",
    );
  });
});

describe("reviewedNameChange", () => {
  it("is null when the founder changed nothing", () => {
    assert.deepEqual(reviewedNameChange({ name: "Maria New", reason: "x" }, undefined), {
      ok: true,
      name: "Maria New",
      corrected: null,
    });
    assert.deepEqual(reviewedNameChange({ name: "Maria New", reason: "x" }, "  Maria   New "), {
      ok: true,
      name: "Maria New",
      corrected: null,
    });
  });

  it("keeps her reason beside the founder's corrected name", () => {
    assert.deepEqual(reviewedNameChange({ name: "maria new", reason: "I married" }, "Maria New"), {
      ok: true,
      name: "Maria New",
      corrected: { name: "Maria New", reason: "I married" },
    });
  });

  it("refuses an empty or over-long name", () => {
    assert.deepEqual(reviewedNameChange({ name: "Maria New", reason: null }, "   "), {
      ok: false,
      message: "Enter the name to approve.",
    });
    assert.equal(reviewedNameChange({ name: "Maria New", reason: null }, "a".repeat(81)).ok, false);
  });
});

describe("profileChangeDbErrorMessage", () => {
  it("explains each refusal in plain words", () => {
    assert.deepEqual(profileChangeDbErrorMessage({ code: "23505", message: "x pending y" }, "submit"), {
      status: 409,
      message: "You already have a request waiting. Withdraw it to send a new one.",
    });
    assert.deepEqual(profileChangeDbErrorMessage({ code: "55000", message: "request is already approved" }, "withdraw"), {
      status: 409,
      message: "DocCy has already decided this request. Reload the page to see the result.",
    });
    assert.deepEqual(profileChangeDbErrorMessage({ code: "55000", message: "request x is already withdrawn" }, "decide"), {
      status: 409,
      message: "This request was already decided or withdrawn. Reload the page.",
    });
    assert.deepEqual(
      profileChangeDbErrorMessage({ code: "55000", message: "the name changed since this request was made" }, "decide"),
      { status: 409, message: "The name changed since this request was made. Deny it and ask for a new request." },
    );
    assert.deepEqual(profileChangeDbErrorMessage({ code: "23505", message: "the address x belongs" }, "decide"), {
      status: 409,
      message: "That profile address was just taken. Try approving again.",
    });
    assert.deepEqual(profileChangeDbErrorMessage({ code: "42501", message: "x" }, "decide"), {
      status: 403,
      message: "Only founders can decide requests.",
    });
    assert.equal(profileChangeDbErrorMessage({ code: "XX000", message: "boom" }, "submit").status, 500);
  });
});

describe("emails", () => {
  it("tells the founders what she asked, with the review link", () => {
    const { subject, text } = buildProfileChangeNotifyContent({
      kind: "name",
      professionalName: "Maria Ioannou",
      requestedName: "Maria Georgiou",
      reason: "I married",
      siteUrl: "https://www.mydoccy.com/",
    });
    assert.equal(subject, "[NAME CHANGE] Maria Ioannou → Maria Georgiou");
    assert.match(text, /Reason: I married/);
    assert.match(text, /https:\/\/www\.mydoccy\.com\/internal\/directory\?tab=requests/);

    const photo = buildProfileChangeNotifyContent({
      kind: "photo",
      professionalName: "Maria Ioannou",
      siteUrl: "https://www.mydoccy.com",
    });
    assert.equal(photo.subject, "[PHOTO CHANGE] Maria Ioannou");
  });

  it("tells her the new name is live, the new address, and that old links still work", () => {
    const email = buildProfileChangeApprovedEmail({
      kind: "name",
      firstName: "Maria",
      siteUrl: "https://www.mydoccy.com",
      approvedName: "Maria Georgiou",
      requestedName: "maria georgiou",
      profilePath: "/en/maria-georgiou",
      addressChanged: true,
    });
    assert.equal(email.subject, "[DocCy] Your name change is approved");
    assert.match(email.text, /Hi Maria,/);
    assert.match(email.text, /now shows the name Maria Georgiou/);
    assert.match(email.text, /We adjusted the spelling you sent \(maria georgiou\)/);
    assert.match(email.text, /https:\/\/www\.mydoccy\.com\/en\/maria-georgiou/);
    assert.match(email.text, /old address still works/);
    assert.match(email.html, /Maria Georgiou/);
  });

  it("does not mention the address when it stayed", () => {
    const email = buildProfileChangeApprovedEmail({
      kind: "name",
      firstName: "Maria",
      siteUrl: "https://www.mydoccy.com",
      approvedName: "María Ioannou",
      requestedName: "María Ioannou",
      profilePath: "/en/maria-ioannou",
      addressChanged: false,
    });
    assert.doesNotMatch(email.text, /old address/);
    assert.doesNotMatch(email.text, /adjusted the spelling/);
  });

  it("tells her the photo is live", () => {
    const email = buildProfileChangeApprovedEmail({
      kind: "photo",
      firstName: "Maria",
      siteUrl: "https://www.mydoccy.com",
      profilePath: "/en/maria-ioannou",
    });
    assert.equal(email.subject, "[DocCy] Your new photo is approved");
    assert.match(email.text, /new photo is now on your profile/);
  });

  it("gives the reason for a denial and where to ask again; the html is escaped", () => {
    const email = buildProfileChangeDeniedEmail({
      kind: "name",
      firstName: "Maria",
      siteUrl: "https://www.mydoccy.com",
      reason: "Name <b>differs</b> from your licence.",
    });
    assert.equal(email.subject, "[DocCy] Your name change was not approved");
    assert.match(email.text, /Reason: Name <b>differs<\/b> from your licence\./);
    assert.match(email.text, /\/settings\?section=profile/);
    assert.match(email.html, /&lt;b&gt;differs&lt;\/b&gt;/);
    assert.equal(
      buildProfileChangeDeniedEmail({ kind: "photo", firstName: "Maria", siteUrl: "x", reason: "Logo." }).subject,
      "[DocCy] Your new photo was not approved",
    );
  });
});
