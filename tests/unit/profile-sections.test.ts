import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PROFILE_SECTION_IDS, profileSectionTabs } from "../../lib/public/profile-sections";
import { buildProfileClinicCards } from "../../lib/public/profile-clinic-cards";

describe("profileSectionTabs", () => {
  it("anchors every section in page order when there is content for all", () => {
    assert.deepEqual(
      profileSectionTabs({ hasServices: true, hasClinics: true }).map((tab) => tab.id),
      ["book", "about", "services", "clinics"],
    );
  });

  it("hides the tabs of sections that would be empty", () => {
    assert.deepEqual(
      profileSectionTabs({ hasServices: false, hasClinics: false }).map((tab) => tab.id),
      ["book", "about"],
    );
    assert.deepEqual(
      profileSectionTabs({ hasServices: false, hasClinics: true }).map((tab) => tab.id),
      ["book", "about", "clinics"],
    );
  });

  it("uses the same ids as the section elements and a translation key per tab", () => {
    assert.deepEqual(PROFILE_SECTION_IDS, {
      book: "book",
      about: "about",
      services: "services",
      clinics: "clinics",
    });
    for (const tab of profileSectionTabs({ hasServices: true, hasClinics: true })) {
      assert.match(tab.labelKey, /^sectionTab[A-Z]\w+$/);
    }
  });
});

const fallbackTitle = (n: number) => `Clinic ${n}`;

describe("buildProfileClinicCards", () => {
  const centre = {
    id: "loc-1",
    label: "Limassol Centre Clinic",
    clinic_address: "12 Anexartisias, Limassol",
    town: "Limassol",
    district: "Limassol",
  };
  const germasogeia = {
    id: "loc-2",
    label: null,
    clinic_address: null,
    town: "Germasogeia",
    district: "Limassol",
  };

  it("makes one card per clinic with its phone, map and booking state", () => {
    const cards = buildProfileClinicCards({
      locations: [centre, germasogeia],
      clinicForLocation: (loc) =>
        loc.id === "loc-1" ? { id: "clinic-1", name: "Centre", hasPhone: true } : null,
      phoneClinics: [{ id: "clinic-1", name: "Centre", hasPhone: true }],
      selectedLocationId: "loc-2",
      fallbackTitle,
      missingAddress: "Address coming soon",
    });

    assert.equal(cards.length, 2);
    assert.equal(cards[0].title, "Limassol Centre Clinic");
    assert.equal(cards[0].address, "12 Anexartisias, Limassol");
    assert.ok(cards[0].mapsUrl.length > 0);
    assert.equal(cards[0].phoneClinicId, "clinic-1");
    assert.equal(cards[0].isBookingHere, false);

    assert.equal(cards[1].title, "Clinic 2");
    assert.equal(cards[1].address, "Germasogeia");
    assert.equal(cards[1].phoneClinicId, null);
    assert.equal(cards[1].isBookingHere, true);
  });

  it("does not mark 'booking here' when there is a single clinic", () => {
    const cards = buildProfileClinicCards({
      locations: [centre],
      clinicForLocation: () => null,
      phoneClinics: [],
      selectedLocationId: "loc-1",
      fallbackTitle,
      missingAddress: "Address coming soon",
    });
    assert.equal(cards.length, 1);
    assert.equal(cards[0].isBookingHere, false);
  });

  it("keeps a clinic phone that matches no location as its own contact card", () => {
    const cards = buildProfileClinicCards({
      locations: [centre],
      clinicForLocation: () => null,
      phoneClinics: [{ id: "clinic-9", name: "Night Clinic", hasPhone: true }],
      selectedLocationId: "loc-1",
      fallbackTitle,
      missingAddress: "Address coming soon",
    });
    assert.equal(cards.length, 2);
    assert.deepEqual(
      { title: cards[1].title, phone: cards[1].phoneClinicId, address: cards[1].address, maps: cards[1].mapsUrl },
      { title: "Night Clinic", phone: "clinic-9", address: "", maps: "" },
    );
  });

  it("falls back to the profile address when there is no clinic row", () => {
    const cards = buildProfileClinicCards({
      locations: [],
      clinicForLocation: () => null,
      phoneClinics: [],
      selectedLocationId: null,
      fallbackTitle,
      missingAddress: "Address coming soon",
      fallbackAddress: "5 Makariou, Paphos",
    });
    assert.equal(cards.length, 1);
    assert.equal(cards[0].title, "Clinic 1");
    assert.equal(cards[0].address, "5 Makariou, Paphos");
  });

  it("returns nothing when there is nothing to show", () => {
    assert.deepEqual(
      buildProfileClinicCards({
        locations: [],
        clinicForLocation: () => null,
        phoneClinics: [{ id: "x", name: "No phone", hasPhone: false }],
        selectedLocationId: null,
        fallbackTitle,
        missingAddress: "Address coming soon",
      }),
      [],
    );
  });
});
