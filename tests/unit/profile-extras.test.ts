import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WeeklySchedule } from "../../lib/doctor-settings";
import { finderResultsPath } from "../../lib/finder-public-path";
import {
  clinicOpeningHours,
  formatOpeningDays,
} from "../../lib/public/clinic-opening-hours";
import { profileBreadcrumbs } from "../../lib/public/profile-breadcrumbs";
import { buildProfileStructuredData } from "../../lib/public/profile-structured-data";

const closed = { enabled: false, start_time: "09:00:00", end_time: "17:00:00" };
const open = (start: string, end: string) => ({
  enabled: true,
  start_time: `${start}:00`,
  end_time: `${end}:00`,
});
function week(partial: Partial<WeeklySchedule>): WeeklySchedule {
  return {
    monday: closed,
    tuesday: closed,
    wednesday: closed,
    thursday: closed,
    friday: closed,
    saturday: closed,
    sunday: closed,
    ...partial,
  };
}

describe("clinicOpeningHours", () => {
  it("groups days with the same hours and splits them around the break", () => {
    const groups = clinicOpeningHours(
      week({
        monday: open("09:00", "17:00"),
        tuesday: open("09:00", "17:00"),
        wednesday: open("09:00", "17:00"),
        thursday: open("09:00", "17:00"),
        friday: open("09:00", "17:00"),
        saturday: open("10:00", "13:00"),
      }),
      { breakStart: "13:00", breakEnd: "14:00" },
    );
    assert.deepEqual(groups, [
      {
        days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        ranges: [
          { open: "09:00", close: "13:00" },
          { open: "14:00", close: "17:00" },
        ],
      },
      // The break is outside Saturday's hours: one range.
      { days: ["saturday"], ranges: [{ open: "10:00", close: "13:00" }] },
    ]);
  });

  it("joins non-consecutive days with the same hours", () => {
    const groups = clinicOpeningHours(
      week({ monday: open("16:00", "20:00"), wednesday: open("16:00", "20:00") }),
      {},
    );
    assert.deepEqual(groups, [
      { days: ["monday", "wednesday"], ranges: [{ open: "16:00", close: "20:00" }] },
    ]);
  });

  it("returns nothing when the clinic has no open day", () => {
    assert.deepEqual(clinicOpeningHours(week({}), {}), []);
  });
});

describe("formatOpeningDays", () => {
  const label = (day: string) => day.slice(0, 1).toUpperCase() + day.slice(1, 3);
  it("writes runs of three or more days as a range", () => {
    assert.equal(
      formatOpeningDays(["monday", "tuesday", "wednesday", "thursday", "friday"], label),
      "Mon–Fri",
    );
    assert.equal(formatOpeningDays(["monday", "tuesday", "wednesday", "friday"], label), "Mon–Wed, Fri");
    assert.equal(formatOpeningDays(["monday", "tuesday"], label), "Mon, Tue");
    assert.equal(formatOpeningDays(["saturday"], label), "Sat");
  });
});

describe("profileBreadcrumbs", () => {
  it("goes specialty › district › professional, like the finder", () => {
    assert.deepEqual(
      profileBreadcrumbs({ specialty: "Dermatology", district: "Nicosia", name: "Dr. Eleni Georgiou" }),
      [
        { label: "Dermatology", href: finderResultsPath(null, "Dermatology") },
        { label: "Nicosia", href: finderResultsPath("Nicosia", "Dermatology") },
        { label: "Dr. Eleni Georgiou", href: null },
      ],
    );
  });

  it("skips what the profile does not have", () => {
    assert.deepEqual(profileBreadcrumbs({ specialty: "", district: "Paphos", name: "X" }), [
      { label: "Paphos", href: finderResultsPath("Paphos", null) },
      { label: "X", href: null },
    ]);
    assert.deepEqual(profileBreadcrumbs({ specialty: null, district: null, name: "X" }), [
      { label: "X", href: null },
    ]);
  });
});

describe("buildProfileStructuredData", () => {
  const data = buildProfileStructuredData({
    name: "Dr. Eleni Georgiou",
    profileUrl: "https://www.mydoccy.com/en/eleni",
    siteUrl: "https://www.mydoccy.com",
    specialty: "Dermatology",
    description: "Skin care.",
    imageUrl: "https://img/eleni.jpg",
    languages: ["Greek", "English"],
    services: [
      { name: "Mole check", price: "70" },
      { name: "Cryotherapy", price: null },
    ],
    clinics: [
      {
        name: "Limassol Centre Clinic",
        address: "12 Anexartisias, Limassol",
        district: "Limassol",
        latitude: 34.68,
        longitude: 33.04,
        openingHours: [
          { days: ["monday", "tuesday"], ranges: [{ open: "09:00", close: "13:00" }] },
        ],
      },
      { name: "Germasogeia", address: "", district: "Limassol", latitude: null, longitude: null, openingHours: [] },
    ],
    breadcrumbs: [
      { label: "Dermatology", href: "/all/dermatology" },
      { label: "Dr. Eleni Georgiou", href: null },
    ],
  });

  it("describes the professional as a Physician with services, languages and every clinic", () => {
    const physician = data.find((item) => item["@type"] === "Physician")!;
    assert.equal(physician.url, "https://www.mydoccy.com/en/eleni");
    assert.equal(physician.medicalSpecialty, "Dermatology");
    assert.deepEqual(physician.knowsLanguage, ["Greek", "English"]);
    assert.deepEqual(
      (physician.availableService as Array<{ name: string }>).map((s) => s.name),
      ["Mole check", "Cryotherapy"],
    );
    const address = physician.address as { addressCountry: string };
    assert.equal(address.addressCountry, "CY");
    const locations = physician.location as Array<Record<string, unknown>>;
    assert.equal(locations.length, 2);
    assert.equal(locations[0]["@type"], "MedicalClinic");
    assert.deepEqual(locations[0].geo, { "@type": "GeoCoordinates", latitude: 34.68, longitude: 33.04 });
    assert.deepEqual(locations[0].openingHoursSpecification, [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday"], opens: "09:00", closes: "13:00" },
    ]);
    // No phone numbers: they stay behind the reveal button.
    assert.equal(JSON.stringify(data).includes("telephone"), false);
  });

  it("adds a BreadcrumbList with absolute links ending on the profile", () => {
    const crumbs = data.find((item) => item["@type"] === "BreadcrumbList")!;
    const items = crumbs.itemListElement as Array<{ position: number; name: string; item: string }>;
    assert.deepEqual(items, [
      { "@type": "ListItem", position: 1, name: "Dermatology", item: "https://www.mydoccy.com/all/dermatology" },
      { "@type": "ListItem", position: 2, name: "Dr. Eleni Georgiou", item: "https://www.mydoccy.com/en/eleni" },
    ] as never);
  });
});
