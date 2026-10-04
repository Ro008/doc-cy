import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { DoctorLocationRow } from "@/lib/doctor-locations";
import {
  PROFESSIONAL_ACCOUNT_SETTINGS_SELECT,
  clinicForAppointment,
  clinicSlotMinutes,
  linkIdForClinic,
  settingsAtClinic,
} from "@/lib/professional-account-settings";

// Point E6: a professional's schedule (days, hours, break, slot length, pause) lives on
// each clinic link (`professional_clinics`). `professional_settings` keeps only the
// account-level settings; the copies of the primary clinic's schedule are dropped
// (user, 2026-10-01).
const root = path.resolve(__dirname, "../..");

const DROPPED_SETTINGS_COLUMNS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "start_time",
  "end_time",
  "break_start",
  "break_end",
  "slot_duration_minutes",
  "weekly_schedule",
  "pause_online_bookings",
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

function namesColumn(text: string, column: string): boolean {
  return new RegExp(`(^|[^A-Za-z0-9_.-])${column}([^A-Za-z0-9_-]|$)`).test(text);
}

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
 * Each `.from("professional_settings")` call up to the end of its statement, plus the
 * select strings and payload objects it names through a variable.
 */
function settingsQueries(src: string): string[] {
  const out: string[] = [];
  const call = /\.from\(\s*["'`]professional_settings["'`]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = call.exec(src))) {
    const rest = src.slice(m.index + m[0].length, m.index + m[0].length + 1500);
    const stop = rest.search(/;|\.from\(/);
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

describe("nothing reads or writes the professional_settings schedule copies (Point E6)", () => {
  it("queries on professional_settings name none of them", () => {
    const offenders: string[] = [];
    for (const file of codeFiles()) {
      const src = readFileSync(file, "utf8");
      for (const query of settingsQueries(src)) {
        for (const column of DROPPED_SETTINGS_COLUMNS) {
          if (namesColumn(query, column)) offenders.push(`${rel(file)}: ${column}`);
        }
      }
    }
    assert.deepEqual([...new Set(offenders)], []);
  });

  it("no query selects * from professional_settings (the column list is explicit)", () => {
    const offenders = codeFiles().flatMap((file) =>
      settingsQueries(readFileSync(file, "utf8"))
        .filter((query) => /\.select\(\s*["'`]\*["'`]/.test(query))
        .map(() => rel(file)),
    );
    assert.deepEqual([...new Set(offenders)], []);
  });

  it("the account settings select is the professional-level columns only", () => {
    assert.equal(
      PROFESSIONAL_ACCOUNT_SETTINGS_SELECT,
      "professional_id, holiday_mode_enabled, holiday_start_date, holiday_end_date, booking_horizon_days, minimum_notice_hours",
    );
  });

  it("seeds and CI fixtures neither insert nor read them", () => {
    for (const file of [
      "supabase/ci/seed.sql",
      "supabase/ci/fixtures.sql",
      "supabase/integration_seed_doccy_testing.sql",
      "supabase/integration_restore_manual_test_doctors.sql",
    ]) {
      const sql = readFileSync(path.join(root, file), "utf8");
      const inserts =
        sql.match(/insert\s+into\s+(?:public\.)?professional_settings\s*\(([^)]*)\)/gi) ?? [];
      for (const insert of inserts) {
        for (const column of DROPPED_SETTINGS_COLUMNS) {
          assert.ok(!namesColumn(insert, column), `${file} inserts professional_settings.${column}`);
        }
      }
      assert.ok(!/\bps\.pause_online_bookings\b/.test(sql), `${file} reads the settings pause`);
    }
  });

  it("the settings save writes the schedule to the clinic links only", () => {
    const route = readFileSync(path.join(root, "app/api/doctor-settings/route.ts"), "utf8");
    assert.ok(route.includes("writeClinicSettings("), "settings save must write the clinic links");
    assert.ok(!route.includes("legacyPayload"), "the legacy schedule payload is gone");
  });
});

function loc(partial: Partial<DoctorLocationRow> & { id: string }): DoctorLocationRow {
  return {
    doctor_id: "doc-1",
    is_primary: false,
    sort_order: 0,
    label: null,
    district: "Nicosia",
    clinic_address: "1 Main St",
    town: null,
    latitude: null,
    longitude: null,
    clinic_place_id: null,
    pause_online_bookings: false,
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    start_time: "09:00:00",
    end_time: "17:00:00",
    weekly_schedule: null,
    break_start: null,
    break_end: null,
    slot_duration_minutes: 30,
    ...partial,
  };
}

const primary = loc({ id: "p", is_primary: true, slot_duration_minutes: 45, break_start: "13:00:00", break_end: "14:00:00" });
const second = loc({ id: "s", sort_order: 1, slot_duration_minutes: 20, pause_online_bookings: true, saturday: true });
const account = {
  professional_id: "doc-1",
  holiday_mode_enabled: true,
  holiday_start_date: "2026-12-20",
  holiday_end_date: "2026-12-31",
  booking_horizon_days: 30,
  minimum_notice_hours: 24,
};

describe("schedule at a clinic (Point E6)", () => {
  it("picks the appointment's clinic, else the primary, else none", () => {
    assert.equal(clinicForAppointment([second, primary], "s")?.id, "s");
    assert.equal(clinicForAppointment([second, primary], null)?.id, "p");
    assert.equal(clinicForAppointment([second, primary], "gone")?.id, "p");
    assert.equal(clinicForAppointment([], "s"), null);
  });

  it("finds her clinic link for an appointment's clinic (appointments.clinic_id = clinics.id)", () => {
    const a = loc({ id: "p", clinic_id: "clinic-a" } as never);
    const b = loc({ id: "s", clinic_id: "clinic-b" } as never);
    assert.equal(linkIdForClinic([a, b], "clinic-b"), "s");
    assert.equal(linkIdForClinic([a, b], "s"), null);
    assert.equal(linkIdForClinic([a, b], null), null);
  });

  it("merges the clinic's schedule with the account settings", () => {
    const merged = settingsAtClinic(account, [primary, second], "s");
    assert.ok(merged);
    assert.equal(merged.slot_duration_minutes, 20);
    assert.equal(merged.pause_online_bookings, true);
    assert.equal(merged.saturday, true);
    assert.equal(merged.booking_horizon_days, 30);
    assert.equal(merged.minimum_notice_hours, 24);
    assert.equal(merged.holiday_mode_enabled, true);
    assert.equal(merged.holiday_end_date, "2026-12-31");
  });

  it("uses the primary clinic and default account settings when none are given", () => {
    const merged = settingsAtClinic(null, [second, primary]);
    assert.ok(merged);
    assert.equal(merged.slot_duration_minutes, 45);
    assert.equal(merged.break_start, "13:00:00");
    assert.equal(merged.holiday_mode_enabled, false);
    assert.equal(merged.booking_horizon_days, 90);
    assert.equal(merged.minimum_notice_hours, 2);
  });

  it("has no schedule without a clinic", () => {
    assert.equal(settingsAtClinic(account, []), null);
  });

  it("slot length: the appointment's clinic, else the primary, else 30", () => {
    assert.equal(clinicSlotMinutes([primary, second], "s"), 20);
    assert.equal(clinicSlotMinutes([primary, second], null), 45);
    assert.equal(clinicSlotMinutes([primary, second], "gone"), 45);
    assert.equal(clinicSlotMinutes([], null), 30);
    assert.equal(clinicSlotMinutes([loc({ id: "z", is_primary: true, slot_duration_minutes: 0 })]), 30);
  });
});
