import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildRegisteredProfileMetaDescription,
  buildRegisteredProfileMetaTitle,
} from "@/lib/doctor-seo-formatting";
import * as fieldsets from "@/lib/doctor-fieldsets";
import { shouldShowFirstLoginTrialNotice } from "@/lib/first-login-trial-notice";

// Point E8: `professionals.status` is dropped. Registration is decided in `request_log`,
// so a professional row is registered only once the founders approved it: `is_registered`
// is the whole rule (agenda, public profile, finder, sitemap, availability). The account
// review screen, the "profile not live" page and the custom-specialty review (nothing can
// create a pending specialty since approval writes them approved) go with it.
const root = path.resolve(__dirname, "../..");

const REMOVED_FILES = [
  "app/agenda/account-review/page.tsx",
  "components/doctor/DoctorAccountReviewScreen.tsx",
  "components/doctor/ProfileNotLive.tsx",
  "lib/doctor-account-access.ts",
  "lib/api/doctor-product-guard.ts",
  "app/api/internal/doctors/specialty-review/route.ts",
  "components/internal/PendingSpecialtiesPanel.tsx",
  "lib/pending-specialty-review.ts",
  "lib/send-doctor-account-rejected-email.ts",
  "tests/unit/pending-specialty-review.test.ts",
  "tests/integration/doctor_account_access.integration.spec.ts",
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(full);
  }
  return out;
}

function codeFiles(): string[] {
  return [
    ...["app", "lib", "components", "scripts", "tests/integration", "tests/prod"].flatMap((dir) =>
      existsSync(path.join(root, dir)) ? sourceFiles(path.join(root, dir)) : [],
    ),
    ...readdirSync(path.join(root, "tests"))
      .filter((name) => name.endsWith(".spec.ts"))
      .map((name) => path.join(root, "tests", name)),
    path.join(root, "middleware.ts"),
  ];
}

function rel(file: string): string {
  return path.relative(root, file).replace(/\\/g, "/");
}

const namesStatus = (text: string) => /(^|[^A-Za-z0-9_.-])status([^A-Za-z0-9_-]|$)/.test(text);

/** The `{ ... }` object literal starting at `open` (balanced braces). */
function objectLiteralAt(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return src.slice(open);
}

/**
 * Each `.from("professionals")` call up to the end of its statement (without the
 * `{ status: 500 }`-style response objects that may follow), plus the select strings and
 * payload objects it names through a variable.
 */
function professionalsQueries(src: string): string[] {
  const out: string[] = [];
  const call = /\.from\(\s*["'`]professionals["'`]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = call.exec(src))) {
    const rest = src.slice(m.index + m[0].length, m.index + m[0].length + 1500);
    const stop = rest.search(/;|\.from\(|\bif\s*\(|\breturn\b/);
    const statement = stop >= 0 ? rest.slice(0, stop) : rest;
    out.push(statement);
    for (const ref of statement.matchAll(
      /\.(select|upsert|update|insert)\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g,
    )) {
      const name = ref[2]!;
      const str = new RegExp(
        String.raw`\b(?:const|let)\s+${name}\s*(?::[^=]+)?=\s*(["'` + "`" + String.raw`])([\s\S]*?)\1`,
      ).exec(src);
      if (str) out.push(str[2] ?? "");
      const obj = new RegExp(String.raw`\b(?:const|let)\s+${name}\s*(?::[^=]+)?=\s*\{`).exec(src);
      if (obj) out.push(objectLiteralAt(src, obj.index + obj[0].length - 1));
    }
  }
  return out;
}

describe("professionals.status is gone from the code (Point E8)", () => {
  it("the account review, not-live page and specialty review files are removed", () => {
    assert.deepEqual(
      REMOVED_FILES.filter((file) => existsSync(path.join(root, file))),
      [],
    );
  });

  it("no query on professionals reads, filters or writes status", () => {
    const offenders: string[] = [];
    for (const file of codeFiles()) {
      const src = readFileSync(file, "utf8");
      for (const query of professionalsQueries(src)) {
        if (namesStatus(query)) offenders.push(rel(file));
      }
      // Embedded selects (`professionals!inner(..., status)`) and their filters.
      for (const embed of src.matchAll(/professionals(?:!inner)?\(([^)]*)\)/g)) {
        if (namesStatus(embed[1] ?? "")) offenders.push(`${rel(file)} (embed)`);
      }
      if (/["'`]professionals\.status["'`]/.test(src)) offenders.push(`${rel(file)} (filter)`);
    }
    assert.deepEqual([...new Set(offenders)], []);
  });

  it("the professional field lists do not include status", () => {
    for (const [name, value] of Object.entries(fieldsets)) {
      if (typeof value === "string") assert.ok(!namesStatus(value), `${name} selects status`);
    }
  });

  it("nothing links to the old account review screen or the specialty review route", () => {
    const offenders = codeFiles()
      .filter((file) => /account-review|specialty-review/.test(readFileSync(file, "utf8")))
      .map(rel);
    assert.deepEqual(offenders, []);
  });

  it("seeds and CI fixtures do not insert professionals.status", () => {
    for (const file of [
      "supabase/ci/seed.sql",
      "supabase/ci/fixtures.sql",
      "supabase/integration_seed_doccy_testing.sql",
      "supabase/integration_restore_manual_test_doctors.sql",
    ]) {
      const sql = readFileSync(path.join(root, file), "utf8");
      const inserts = sql.match(/insert\s+into\s+(?:public\.)?professionals\s*\(([^)]*)\)/gi) ?? [];
      for (const insert of inserts) {
        assert.ok(!namesStatus(insert), `${file} inserts professionals.status`);
      }
    }
  });
});

describe("a registered professional is live (Point E8)", () => {
  it("first-login notice depends only on whether it was dismissed", () => {
    assert.equal(shouldShowFirstLoginTrialNotice({ trialNoticeSeenAt: null }), true);
    assert.equal(
      shouldShowFirstLoginTrialNotice({ trialNoticeSeenAt: "2026-09-09T12:00:00.000Z" }),
      false,
    );
  });

  it("profile title and description always offer online booking", () => {
    assert.equal(
      buildRegisteredProfileMetaTitle({
        doctorName: "Maria Georgiou",
        specialty: "Cardiology",
        districtLabel: "Limassol",
      }),
      "Book Online with Maria Georgiou | Cardiology in Limassol | DocCy",
    );
    assert.equal(
      buildRegisteredProfileMetaDescription({
        doctorName: "Maria Georgiou",
        specialtyForSeo: "",
        cityLabel: "Cyprus",
      }),
      "Book online with Maria Georgiou in Cyprus via DocCy.",
    );
  });
});
