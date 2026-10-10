import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_QUALIFICATIONS,
  PATIENT_AGE_OPTIONS,
  validateNameChangeRequest,
  validateQualification,
} from "../../lib/settings-profile-details";

/**
 * Profile tab additions (user, 2026-10-10): the name changes by request, "who you see"
 * is one of three choices, and qualifications are a short list. The form checks these
 * before it sends anything; the backend will check them again.
 */

describe("validateNameChangeRequest", () => {
  it("accepts a different full name, trimmed and single-spaced", () => {
    assert.deepEqual(validateNameChangeRequest("Maria Merakli", "  Maria   Merakli-Ioannou "), {
      ok: true,
      name: "Maria Merakli-Ioannou",
    });
    assert.equal(validateNameChangeRequest("Maria Merakli", "Μαρία Μερακλή").ok, true);
    assert.equal(validateNameChangeRequest("Maria Merakli", "Seán O'Brien").ok, true);
  });

  it("asks for a name and a surname", () => {
    for (const requested of ["", "   ", "Maria"]) {
      const result = validateNameChangeRequest("Maria Merakli", requested);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.message, "Enter your first name and surname.");
    }
  });

  it("refuses the same name, whatever the case or spacing", () => {
    const result = validateNameChangeRequest("Maria Merakli", " maria  merakli ");
    assert.deepEqual(result, { ok: false, message: "That is already your name on DocCy." });
    // Also when the current name has characters a new one may not (old test data).
    assert.deepEqual(validateNameChangeRequest("Maria Merakli 2", "Maria Merakli 2"), {
      ok: false,
      message: "That is already your name on DocCy.",
    });
  });

  it("refuses digits, symbols and titles: the profile adds none", () => {
    for (const requested of ["Maria Merakli 2", "Maria @Merakli", "Maria <b>Merakli</b>"]) {
      const result = validateNameChangeRequest("Maria Merakli", requested);
      assert.deepEqual(result, { ok: false, message: "Use letters, spaces, hyphens and apostrophes only." });
    }
    assert.deepEqual(validateNameChangeRequest("Maria Merakli", "Dr. Maria Ioannou"), {
      ok: false,
      message: "Leave out titles such as Dr or Prof.",
    });
    assert.deepEqual(validateNameChangeRequest("Maria Merakli", "Prof Maria Ioannou"), {
      ok: false,
      message: "Leave out titles such as Dr or Prof.",
    });
  });

  it("refuses a name longer than 80 characters", () => {
    const result = validateNameChangeRequest("Maria Merakli", `Maria ${"a".repeat(80)}`);
    assert.deepEqual(result, { ok: false, message: "Keep the name under 80 characters." });
  });
});

describe("PATIENT_AGE_OPTIONS", () => {
  it("offers adults, children, or both", () => {
    assert.deepEqual(
      PATIENT_AGE_OPTIONS.map((option) => [option.value, option.label]),
      [
        ["adults", "Adults"],
        ["children", "Children"],
        ["all", "Adults and children"],
      ],
    );
  });
});

describe("validateQualification", () => {
  const thisYear = 2026;

  it("accepts a title and an institution, with or without a year", () => {
    assert.deepEqual(
      validateQualification({ title: " MD, Medicine ", institution: " University of Athens ", year: "2009" }, thisYear),
      { ok: true, qualification: { title: "MD, Medicine", institution: "University of Athens", year: 2009 } },
    );
    assert.deepEqual(
      validateQualification({ title: "Fellowship in Cardiology", institution: "King's College London", year: "" }, thisYear),
      { ok: true, qualification: { title: "Fellowship in Cardiology", institution: "King's College London", year: null } },
    );
  });

  it("says which field is wrong", () => {
    assert.deepEqual(validateQualification({ title: "", institution: "", year: "" }, thisYear), {
      ok: false,
      errors: { title: "Enter the qualification.", institution: "Enter where you obtained it." },
    });
    assert.deepEqual(validateQualification({ title: "MD", institution: "UCY", year: "09" }, thisYear), {
      ok: false,
      errors: { year: "Enter a year between 1950 and 2026." },
    });
    assert.deepEqual(validateQualification({ title: "MD", institution: "UCY", year: "2027" }, thisYear), {
      ok: false,
      errors: { year: "Enter a year between 1950 and 2026." },
    });
    assert.deepEqual(validateQualification({ title: "a".repeat(81), institution: "b".repeat(101), year: "" }, thisYear), {
      ok: false,
      errors: {
        title: "Keep the qualification under 80 characters.",
        institution: "Keep the institution under 100 characters.",
      },
    });
  });

  it("caps the list at six", () => {
    assert.equal(MAX_QUALIFICATIONS, 6);
  });
});
