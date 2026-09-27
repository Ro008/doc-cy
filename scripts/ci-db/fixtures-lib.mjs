// Pure pieces of scripts/ci-db/fixtures.mjs (unit-tested in tests/unit/ci-db-fixtures.test.ts).

import { randomBytes } from "node:crypto";

/**
 * The registered, bookable doctor the booking and account specs log in as and book with
 * (CI's TEST_USER_* login, and the `andreas-nikos` slug the schedule specs default to).
 * Mirrors the shape of the Testing profile those specs were written against.
 */
export const FIXTURE_DOCTOR = {
  slug: "andreas-nikos",
  name: "Andreas Nikos",
  email: "andreas-nikos@doccy-ci.test",
  district: "Larnaca",
  town: "Larnaca",
  specialty: "Neurology",
  languages: ["Greek", "English", "Spanish"],
};

/** A fresh password per run: it lives only in this job's disposable stack. */
export function generateFixturePassword() {
  // base64url gives letters, digits, "-" and "_"; the fixed suffix guarantees each class.
  return `${randomBytes(18).toString("base64url")}aA1!`;
}
