import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  USER_EVENTS_TABLE,
  USER_EVENT_TYPES,
  isUniqueViolation,
  missingProfessionalReportEvent,
  onlineAppointmentRequestEvent,
  parseMissingProfessionalReportDetails,
  showPhoneNumberEvent,
} from "@/lib/user-events";

// Point E4: clicks, votes and missing-professional reports go to one `user_events`
// table (user, 2026-10-01); the three old tables and their stats functions are dropped.
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

function read(file: string): string {
  return readFileSync(path.join(root, file), "utf8");
}

const DROPPED = [
  "professional_call_to_book_clicks",
  "professional_patient_booking_requests",
  "missing_professional_requests",
  "founder_call_to_book_stats",
  "founder_manual_vote_stats",
];

describe("user event rows", () => {
  it("names the table and the three event types", () => {
    assert.equal(USER_EVENTS_TABLE, "user_events");
    assert.deepEqual(
      [...USER_EVENT_TYPES],
      ["show_phone_number", "request_online_appointment", "missing_professional_report"],
    );
  });

  it("a Show phone number click is a visitor event on the professional and clinic", () => {
    assert.deepEqual(
      showPhoneNumberEvent({ professionalId: "p1", clinicId: "c1", source: "finder_card" }),
      {
        event_type: "show_phone_number",
        actor_type: "visitor",
        visitor_key: null,
        professional_id: "p1",
        clinic_id: "c1",
        source: "finder_card",
        details: {},
      },
    );
    assert.equal(
      showPhoneNumberEvent({ professionalId: "p1", clinicId: null, source: "professional_profile_page" })
        .clinic_id,
      null,
    );
  });

  it("an online-appointment vote carries the visitor key", () => {
    assert.deepEqual(
      onlineAppointmentRequestEvent({
        professionalId: "p1",
        clinicId: null,
        source: "professional_profile_page",
        visitorKey: "abc",
      }),
      {
        event_type: "request_online_appointment",
        actor_type: "visitor",
        visitor_key: "abc",
        professional_id: "p1",
        clinic_id: null,
        source: "professional_profile_page",
        details: {},
      },
    );
    assert.equal(
      onlineAppointmentRequestEvent({
        professionalId: "p1",
        clinicId: "c1",
        source: "finder_card",
        visitorKey: "  ",
      }).visitor_key,
      null,
    );
  });

  it("a missing-professional report keeps what the visitor typed in details", () => {
    assert.deepEqual(
      missingProfessionalReportEvent({
        details: {
          requested_name: "Dr Anna",
          specialty: "Cardiology",
          district: null,
          search_name: "anna",
        },
        visitorKey: "k1",
      }),
      {
        event_type: "missing_professional_report",
        actor_type: "visitor",
        visitor_key: "k1",
        professional_id: null,
        clinic_id: null,
        source: "finder_empty_state",
        details: {
          requested_name: "Dr Anna",
          specialty: "Cardiology",
          district: null,
          search_name: "anna",
        },
      },
    );
  });
});

describe("parseMissingProfessionalReportDetails", () => {
  it("reads a stored report", () => {
    assert.deepEqual(
      parseMissingProfessionalReportDetails({
        requested_name: " Dr Anna ",
        specialty: "Cardiology",
        district: "Nicosia",
        search_name: null,
      }),
      { requested_name: "Dr Anna", specialty: "Cardiology", district: "Nicosia", search_name: null },
    );
  });

  it("turns missing or blank optional fields into null", () => {
    assert.deepEqual(parseMissingProfessionalReportDetails({ requested_name: "Dr Anna", specialty: " " }), {
      requested_name: "Dr Anna",
      specialty: null,
      district: null,
      search_name: null,
    });
  });

  it("rejects anything without a requested name", () => {
    for (const value of [null, undefined, "x", [], {}, { requested_name: "" }, { requested_name: 3 }]) {
      assert.equal(parseMissingProfessionalReportDetails(value), null, JSON.stringify(value));
    }
  });
});

describe("isUniqueViolation", () => {
  it("recognises Postgres unique violations only", () => {
    assert.equal(isUniqueViolation({ code: "23505" }), true);
    assert.equal(isUniqueViolation({ code: "23514" }), false);
    assert.equal(isUniqueViolation(null), false);
    assert.equal(isUniqueViolation(undefined), false);
  });
});

describe("everything reads and writes user_events (Point E4)", () => {
  it("the three public routes write user_events", () => {
    for (const file of [
      "app/api/directory/contact-reveal/route.ts",
      "app/api/directory-manual/patient-booking-request/route.ts",
      "app/api/finder/doctor-invitation-request/route.ts",
    ]) {
      assert.ok(read(file).includes("USER_EVENTS_TABLE"), `${file} does not use USER_EVENTS_TABLE`);
    }
  });

  it("founder stats come from founder_user_event_stats", () => {
    const page = read("app/internal/directory/page.tsx");
    assert.equal((page.match(/"founder_user_event_stats"/g) ?? []).length, 2);
  });

  it("app, lib, components, middleware, scripts and integration specs never name the old tables", () => {
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

  it("seeds and CI fixtures never name the old tables", () => {
    for (const file of [
      "supabase/ci/seed.sql",
      "supabase/ci/fixtures.sql",
      "supabase/integration_seed_doccy_testing.sql",
      "supabase/integration_restore_manual_test_doctors.sql",
    ]) {
      const named = DROPPED.filter((name) => read(file).includes(name));
      assert.deepEqual(named, [], `${file} still names an old table`);
    }
  });

  it("purging a professional deletes their user events", () => {
    const purge = read("lib/purge-registered-professional.ts");
    assert.ok(purge.includes('"user_events"'));
  });
});
