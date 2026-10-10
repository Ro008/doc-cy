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
  SPECIALTY_ADD_REQUEST_TYPE,
  reviewedSpecialtyAdd,
  photoChangeUploadCheck,
  photoChangeUploadPath,
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
      pending: { id: "r1", createdAt: "2026-10-10T08:00:00Z", name: "Maria New", photoPath: null, licenseNumber: null },
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
      licenseNumber: null,
    });
  });

  it("shows the specialty she asked for, with its licence number", () => {
    const rows = [
      row({
        id: "s1",
        request_type: SPECIALTY_ADD_REQUEST_TYPE,
        details: { name: "Dermatology", from_catalogue: true, license_number: "L-77" },
      }),
    ];
    assert.deepEqual(profileChangeState(rows, SPECIALTY_ADD_REQUEST_TYPE).pending, {
      id: "s1",
      createdAt: "2026-10-10T08:00:00Z",
      name: "Dermatology",
      photoPath: null,
      licenseNumber: "L-77",
    });
    assert.equal(profileChangeState(rows, NAME_CHANGE_REQUEST_TYPE).pending, null);
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

describe("the new photo's file", () => {
  it("takes the cropped JPEG, and PNG or WebP, up to 1 MB", () => {
    assert.deepEqual(photoChangeUploadCheck({ type: "image/jpeg", size: 280 * 1024 }), { ok: true, extension: "jpg" });
    assert.deepEqual(photoChangeUploadCheck({ type: "IMAGE/PNG", size: 1024 * 1024 }), { ok: true, extension: "png" });
    assert.deepEqual(photoChangeUploadCheck({ type: "image/webp", size: 10 }), { ok: true, extension: "webp" });
  });

  it("refuses other files, empty files and files over 1 MB", () => {
    assert.deepEqual(photoChangeUploadCheck({ type: "image/gif", size: 10 }), {
      ok: false,
      message: "Use a JPEG, PNG or WebP image.",
    });
    assert.deepEqual(photoChangeUploadCheck({ type: "image/jpeg", size: 0 }), {
      ok: false,
      message: "The photo must be under 1 MB.",
    });
    assert.equal(photoChangeUploadCheck({ type: "image/jpeg", size: 1024 * 1024 + 1 }).ok, false);
  });

  it("waits in her own folder of the private bucket", () => {
    assert.equal(
      photoChangeUploadPath("11111111-2222-3333-4444-555555555555", "1700000000000-abc", "jpg"),
      "professional_photo_change/11111111-2222-3333-4444-555555555555/1700000000000-abc.jpg",
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

describe("reviewedSpecialtyAdd", () => {
  const asked = { name: "dermatology", fromCatalogue: false, licenseNumber: "l 77" };

  it("is null when the founder changed nothing", () => {
    assert.deepEqual(reviewedSpecialtyAdd(asked, {}), {
      ok: true,
      name: "dermatology",
      licenseNumber: "l 77",
      corrected: null,
    });
  });

  it("records the founder's corrected specialty and licence number", () => {
    assert.deepEqual(reviewedSpecialtyAdd(asked, { name: " Dermatology ", licenseNumber: "L-77" }), {
      ok: true,
      name: "Dermatology",
      licenseNumber: "L-77",
      corrected: { name: "Dermatology", from_catalogue: false, license_number: "L-77" },
    });
  });

  it("refuses an empty specialty or licence number", () => {
    assert.deepEqual(reviewedSpecialtyAdd(asked, { name: " " }), { ok: false, message: "Enter the specialty to approve." });
    assert.deepEqual(reviewedSpecialtyAdd(asked, { licenseNumber: "" }), {
      ok: false,
      message: "Enter the licence number to approve.",
    });
    assert.equal(reviewedSpecialtyAdd(asked, { licenseNumber: "x".repeat(81) }).ok, false);
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
    assert.deepEqual(
      profileChangeDbErrorMessage({ code: "55000", message: "she already has this specialty: deny the request" }, "decide"),
      { status: 409, message: "This professional already has that specialty. Deny the request." },
    );
    assert.deepEqual(
      profileChangeDbErrorMessage({ code: "55000", message: "she already has 5 specialties: deny the request" }, "decide"),
      { status: 409, message: "This professional already has 5 specialties. Deny the request." },
    );
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

  it("covers a specialty request: the founders' notice, the approval and the denial", () => {
    const notice = buildProfileChangeNotifyContent({
      kind: "specialty",
      professionalName: "Maria Ioannou",
      specialty: "Dermatology",
      fromCatalogue: false,
      licenseNumber: "L-77",
      siteUrl: "https://www.mydoccy.com",
    });
    assert.equal(notice.subject, "[SPECIALTY REQUEST] Maria Ioannou: Dermatology");
    assert.match(notice.text, /Licence number: L-77/);
    assert.match(notice.text, /not in the catalogue/);

    const approved = buildProfileChangeApprovedEmail({
      kind: "specialty",
      firstName: "Maria",
      siteUrl: "https://www.mydoccy.com",
      profilePath: "/en/maria-ioannou",
      specialty: "Dermatology",
    });
    assert.equal(approved.subject, "[DocCy] Dermatology is now on your profile");
    assert.match(approved.text, /patients can now find you under Dermatology/i);

    const denied = buildProfileChangeDeniedEmail({
      kind: "specialty",
      firstName: "Maria",
      siteUrl: "https://www.mydoccy.com",
      reason: "We could not verify the licence.",
      specialty: "Dermatology",
    });
    assert.equal(denied.subject, "[DocCy] Your request to add Dermatology was not approved");
    assert.match(denied.text, /Reason: We could not verify the licence\./);
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
