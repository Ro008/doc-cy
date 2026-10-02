import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  BATCH_SEGMENT_MAP,
  importableClinics,
  personBelongsInBatch,
} from "../../scripts/lib/gesy-import-segments.mjs";

// Point E2: Inpatient Services listings are deleted and never imported again;
// professionals.finder_visible and professionals.segment are dropped.
const root = path.resolve(__dirname, "../..");

function person(segments: string[]) {
  return { segments: new Set(segments) };
}

function clinic(ghs: string, segments: string[]) {
  return { ghs_code: ghs, segments: new Set(segments) };
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(full);
  }
  return out;
}

describe("GeSY import skips Inpatient Services (Point E2)", () => {
  it("has no inpatient-only batch", () => {
    assert.ok(!("inpatient-only" in BATCH_SEGMENT_MAP));
  });

  it("never imports an Inpatient Services-only person, in any batch", () => {
    const inpatientOnly = person(["Inpatient Services"]);
    for (const batch of Object.keys(BATCH_SEGMENT_MAP)) {
      assert.equal(personBelongsInBatch(inpatientOnly, batch), false, batch);
    }
    assert.equal(personBelongsInBatch(person(["Inpatient Services", "Pharmacy"]), "outpatient"), false);
  });

  it("still imports a person with a bookable segment besides Inpatient Services", () => {
    const mixed = person(["Inpatient Services", "Outpatient Specialist"]);
    assert.equal(personBelongsInBatch(mixed, "outpatient"), true);
    assert.equal(personBelongsInBatch(mixed, "dentist"), false);
  });

  it("still skips Pharmacy and Laboratory", () => {
    assert.equal(personBelongsInBatch(person(["Pharmacy"]), "personal-doctor"), false);
    assert.equal(personBelongsInBatch(person(["Laboratory", "Personal Doctor"]), "personal-doctor"), true);
  });

  it("links a mixed person's clinics except Pharmacy/Laboratory-only ones", () => {
    const kept = importableClinics([
      clinic("A", ["Outpatient Specialist"]),
      clinic("B", ["Inpatient Services"]),
      clinic("C", ["Pharmacy"]),
    ]).map((c) => c.ghs_code);
    assert.deepEqual(kept, ["A", "B"]);
  });

  it("the importer writes neither finder_visible nor segment", () => {
    const src = readFileSync(path.join(root, "scripts/import-gesy-directory-batch.mjs"), "utf8");
    assert.ok(!/finder_visible/.test(src), "importer still mentions finder_visible");
    assert.ok(!/^\s*segment,\s*$/m.test(src), "importer payload still writes segment");
    assert.ok(!/inpatient-only/.test(src), "importer still has the inpatient-only batch");
  });
});

describe("nothing reads professionals.finder_visible (Point E2)", () => {
  it("app, lib, components, scripts and integration specs never mention finder_visible", () => {
    const offenders = ["app", "lib", "components", "scripts", "tests/integration"]
      .flatMap((dir) => sourceFiles(path.join(root, dir)))
      .filter((file) => readFileSync(file, "utf8").includes("finder_visible"))
      .map((file) => path.relative(root, file));
    assert.deepEqual(offenders, []);
  });

  it("CI seed and fixtures never insert finder_visible or segment", () => {
    for (const file of ["supabase/ci/seed.sql", "supabase/ci/fixtures.sql"]) {
      const src = readFileSync(path.join(root, file), "utf8");
      assert.ok(!/finder_visible|\bsegment\b/.test(src), `${file} still names a dropped column`);
    }
  });
});
