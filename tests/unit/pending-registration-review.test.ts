import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPendingRegistrationNotifyLines } from "../../lib/pending-registration-review";

describe("formatPendingRegistrationNotifyLines", () => {
  it("includes photo, languages, all specialties, and clinics", () => {
    const lines = formatPendingRegistrationNotifyLines({
      name: "Keanu Reeves",
      email: "keanu@example.com",
      phone: "+35799111222",
      languages: ["English", "Greek"],
      specialties: [
        {
          id: "1",
          specialty: "General Practice",
          licenseNumber: "GP-1",
          isApproved: true,
        },
        {
          id: "2",
          specialty: "Cardiology",
          licenseNumber: "CARD-9",
          isApproved: false,
        },
      ],
      primarySpecialty: "General Practice",
      primaryLicenseNumber: "GP-1",
      locations: [
        {
          id: "loc-1",
          district: "Paphos",
          town: "Emba",
          address: "Georgiou Christoforou 25",
          latitude: 34.8,
          longitude: 32.4,
          placeId: "place-1",
          isPrimary: true,
        },
      ],
      fromDirectoryListing: false,
      avatarUrl: "https://example.com/a.jpg",
    });

    assert.ok(lines.some((l) => l.includes("keanu@example.com")));
    assert.ok(lines.some((l) => l.includes("English, Greek")));
    assert.ok(lines.some((l) => l.includes("Cardiology")));
    assert.ok(lines.some((l) => l.includes("Georgiou Christoforou 25")));
    assert.ok(lines.some((l) => l === "Photo uploaded: yes"));
  });
});
