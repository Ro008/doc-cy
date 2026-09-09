import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { professionalAccountEmail } from "@/lib/professional-account-contact";

describe("professionalAccountEmail", () => {
  it("prefers registration_email over scraped directory email", () => {
    assert.equal(
      professionalAccountEmail({
        registration_email: "tasos@gmail.com",
        email: "clinic@scraped.example",
      }),
      "tasos@gmail.com",
    );
  });

  it("falls back to email for rows registered before the split", () => {
    assert.equal(
      professionalAccountEmail({
        registration_email: null,
        email: "legacy@clinic.com",
      }),
      "legacy@clinic.com",
    );
  });
});
