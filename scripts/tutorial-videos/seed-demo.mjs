// Seeds the demo doctor (Dr. Elena Christou) and fictional expat patients on a LOCAL stack,
// for the tutorial videos. Never point this at a real project: it refuses non-local URLs.
//
//   set -a; . <env from scripts/ci-db/load.mjs>; set +a
//   node scripts/tutorial-videos/seed-demo.mjs
//
// Prints DEMO_EMAIL / DEMO_PASSWORD (a fresh password per run).

import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  throw new Error(`Refusing to seed a non-local Supabase URL: ${url}`);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const must = (label, { error, data }) => {
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
};

export const DEMO = {
  slug: "elena-christou",
  name: "Elena Christou",
  email: "elena-christou@doccy-demo.test",
  specialty: "General Practice",
  clinic: "Christou Family Clinic",
};

const proId = "00000000-0000-4000-8000-0000000e1e4a";
const clinicId = "00000000-0000-4000-8000-0000000c11c0";
const password = `${randomBytes(18).toString("base64url")}aA1!`;

const user = must(
  "create auth user",
  await admin.auth.admin.createUser({ email: DEMO.email, password, email_confirm: true }),
);

must(
  "professional",
  await admin.from("professionals").insert({
    id: proId,
    name: DEMO.name,
    slug: DEMO.slug,
    email: DEMO.email,
    registration_email: DEMO.email,
    mobile_number: "+35700999010",
    languages: ["English", "Greek", "German"],
    is_gesy: true,
    is_archived: false,
    is_registered: true,
    is_test_profile: true,
    auth_user_id: user.user.id,
    subscription_tier: "founder",
    trial_notice_seen_at: new Date().toISOString(),
    pro_access_until: new Date(Date.now() + 365 * 864e5).toISOString(),
  }),
);
must(
  "clinic",
  await admin.from("clinics").insert({
    id: clinicId,
    name: DEMO.clinic,
    slug: "christou-family-clinic",
    district: "Limassol",
    town: "Limassol",
    address: "24 Makarios Avenue, Limassol",
    latitude: 34.6841,
    longitude: 33.0379,
    phone: "25999010",
  }),
);
const day = (enabled) => ({ enabled, start_time: "09:00:00", end_time: "18:00:00" });
must(
  "professional_clinics",
  await admin.from("professional_clinics").insert({
    professional_id: proId,
    clinic_id: clinicId,
    is_primary: true,
    sort_order: 0,
    label: DEMO.clinic,
    pause_online_bookings: false,
    monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false,
    start_time: "09:00",
    end_time: "18:00",
    slot_duration_minutes: 30,
    weekly_schedule: {
      monday: day(true), tuesday: day(true), wednesday: day(true), thursday: day(true),
      friday: day(true), saturday: day(false), sunday: day(false),
    },
  }),
);
must("service", await admin.from("professional_services").insert({ professional_id: proId, name: "General consultation", price: 50 }));

const specialty = must("specialty", await admin.from("specialties").select("id,name").eq("name", DEMO.specialty).maybeSingle());
if (specialty) {
  must(
    "professional_specialties",
    await admin.from("professional_specialties").insert({
      professional_id: proId,
      specialty: specialty.name,
      specialty_id: specialty.id,
      license_number: "DEMO-GP-0001",
    }),
  );
}

// Fictional expat patients (Cyprus-based mix). Hours are Cyprus local time (UTC+3 in October,
// UTC+2 after the last Sunday of October); the offset below is computed per date.
const patients = [
  ["Lucia Fernandez", "lucia.fernandez@example.com", "+35799100201", "Persistent cough for two weeks"],
  ["Marco Bellini", "marco.bellini@example.com", "+35799100202", "Annual check-up and blood tests"],
  ["Katrin Vogel", "katrin.vogel@example.com", "+35799100203", "Back pain after moving house"],
  ["Daniel Rosen", "daniel.rosen@example.com", "+35799100204", "Prescription renewal"],
  ["Irene Stavrou", "irene.stavrou@example.com", "+35799100205", "Skin rash on arms"],
  ["Pablo Ortega", "pablo.ortega@example.com", "+35799100206", "Follow-up after flu"],
  ["Giulia Romano", "giulia.romano@example.com", "+35799100207", "Vaccination advice before travelling"],
  ["Jonas Becker", "jonas.becker@example.com", "+35799100208", "Blood pressure review"],
];

function cyprusLocalToUtcIso(dateStr, hhmm) {
  const guess = new Date(`${dateStr}T${hhmm}:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Nicosia", hour12: false, hour: "2-digit", minute: "2-digit",
  }).formatToParts(guess);
  const h = Number(parts.find((p) => p.type === "hour").value);
  const offsetH = (h - guess.getUTCHours() + 24) % 24;
  return new Date(guess.getTime() - offsetH * 3600e3).toISOString();
}
function workingDay(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// off = working days from today (0 = today; on a weekend it rolls to Monday, so the "Today"
// column is only populated on weekdays). ago = minutes since the request was made.
const plan = [
  { p: 7, off: 0, t: "09:30", status: "CONFIRMED", isNew: false },
  { p: 6, off: 0, t: "11:00", status: "CONFIRMED", isNew: true },
  { p: 1, off: 0, t: "14:30", status: "CONFIRMED", isNew: false },
  { p: 0, off: 0, t: "16:00", status: "CONFIRMED", isNew: true },
  { p: 3, off: 0, t: "17:00", status: "CONFIRMED", isNew: false },
  { p: 2, off: 1, t: "10:30", status: "REQUESTED", isNew: true, ago: 8 },
  { p: 5, off: 1, t: "15:00", status: "REQUESTED", isNew: false, ago: 25 },
  { p: 4, off: 2, t: "12:00", status: "REQUESTED", isNew: true, ago: 130 },
];
must(
  "appointments",
  await admin.from("appointments").insert(
    plan.map(({ p, off, t, status, isNew, ago }) => ({
      professional_id: proId,
      patient_name: patients[p][0],
      patient_email: patients[p][1],
      patient_phone: patients[p][2],
      reason: patients[p][3],
      appointment_datetime: cyprusLocalToUtcIso(workingDay(off), t),
      status,
      is_new_patient: isNew,
      created_at: new Date(Date.now() - (ago ?? 1440) * 60e3).toISOString(),
    })),
  ),
);

console.log(`DEMO_EMAIL=${DEMO.email}\nDEMO_PASSWORD=${password}`);
