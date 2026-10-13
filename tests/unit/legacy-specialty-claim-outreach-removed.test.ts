import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { SPECIALTY_LICENSE_MAX, specialtyChangeContactMessage } from "@/lib/doctor-specialties";

// Point E3: the old specialty-change requests, the licence file, the specialty review
// flag, the claim columns and the outreach log are dropped. The settings redesign
// (user, 2026-10-01) asks for a new specialty through the NEW specialty requests,
// /api/specialty-requests, which the backend builds (until then the page says the
// call fails as expected); removing one is instant with the chip's ✕.
const root = path.resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(full);
  }
  return out;
}

const DROPPED = [
  "professional_specialty_change_requests",
  "license_file_url",
  "specialty_requires_standard_at",
  "directory_claim_source",
  "claim_listing_id",
  "directory_manual_outreach_sent",
  "/api/doctor-specialty-change-request",
  "/api/internal/doctors/specialty-change-review",
];

describe("specialties are read-only in settings (Point E3)", () => {
  it("prefills a contact message naming the specialties", () => {
    assert.equal(
      specialtyChangeContactMessage(["Cardiology"]),
      'Hello, I would like to change my specialty "Cardiology". The change is: ',
    );
    const many = "Hello, I would like to change my specialties. The change is: ";
    assert.equal(specialtyChangeContactMessage(["Cardiology", "Dermatology"]), many);
    assert.equal(specialtyChangeContactMessage([]), many);
    assert.equal(specialtyChangeContactMessage([" ", ""]), many);
  });

  it("keeps the licence number limit registration uses", () => {
    assert.equal(SPECIALTY_LICENSE_MAX, 80);
  });

  it("the settings form asks through the new specialty requests, not the old ones", () => {
    const form = readFileSync(path.join(root, "components/dashboard/SettingsForm.tsx"), "utf8");
    assert.ok(form.includes('data-testid="settings-specialty-locked"'));
    assert.ok(form.includes('"/api/specialty-requests"'));
    assert.ok(!form.includes("Request a specialty update"));
    assert.ok(!form.includes("/api/doctor-specialty-change-request"));
  });
});

describe("nothing uses the dropped objects (Point E3)", () => {
  it("the old routes, panel and helpers are gone", () => {
    for (const file of [
      "app/api/doctor-specialty-change-request/route.ts",
      "app/api/internal/doctors/specialty-change-review/route.ts",
      "app/api/internal/doctors/[id]/license/route.ts",
      "components/internal/SpecialtyChangeRequestsPanel.tsx",
      "lib/doctor-specialty-change-request.ts",
      "lib/pending-registration-origin.ts",
    ]) {
      assert.equal(existsSync(path.join(root, file)), false, `${file} still exists`);
    }
  });

  it("app, lib, components, middleware, scripts and integration specs never name them", () => {
    const files = [
      ...["app", "lib", "components", "scripts", "tests/integration"].flatMap((dir) =>
        sourceFiles(path.join(root, dir)),
      ),
      path.join(root, "middleware.ts"),
    ];
    const offenders = files.flatMap((file) => {
      const src = readFileSync(file, "utf8");
      return DROPPED.filter((name) => src.includes(name)).map(
        (name) => `${path.relative(root, file)}: ${name}`,
      );
    });
    assert.deepEqual(offenders, []);
  });

  it("seeds and CI fixtures never insert the dropped columns", () => {
    for (const file of [
      "supabase/ci/seed.sql",
      "supabase/ci/fixtures.sql",
      "supabase/integration_seed_doccy_testing.sql",
      "supabase/integration_restore_manual_test_doctors.sql",
    ]) {
      const src = readFileSync(path.join(root, file), "utf8");
      const named = DROPPED.filter((name) => src.includes(name));
      assert.deepEqual(named, [], `${file} still names a dropped object`);
    }
  });
});
