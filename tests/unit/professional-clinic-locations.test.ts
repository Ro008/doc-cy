import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PROFESSIONAL_CLINIC_LOCATION_SELECT,
  professionalClinicRowToLocation,
  type ProfessionalClinicJoinRow,
} from "../../lib/professional-clinic-locations";

/**
 * Point D2: practice locations are read from professional_clinics -> clinics instead
 * of doctor_locations. The mapping has to produce exactly the DoctorLocationRow every
 * caller already renders, or profiles, agendas, emails and the finder change under
 * them: the join row owns the schedule, the clinic owns the address.
 */

function joinRow(partial: Partial<ProfessionalClinicJoinRow> = {}): ProfessionalClinicJoinRow {
  return {
    id: "join-1",
    professional_id: "pro-1",
    is_primary: true,
    sort_order: 0,
    label: "Evenings",
    pause_online_bookings: false,
    monday: true,
    tuesday: false,
    wednesday: true,
    thursday: false,
    friday: true,
    saturday: false,
    sunday: false,
    start_time: "10:00:00",
    end_time: "18:00:00",
    weekly_schedule: null,
    break_start: "13:00:00",
    break_end: "14:00:00",
    slot_duration_minutes: 45,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-02T10:00:00Z",
    clinics: {
      id: "clinic-1",
      name: "Evangelismos",
      address: "Makariou Avenue 10, Nicosia 1065, Cyprus",
      district: "Nicosia",
      town: "Nicosia",
      latitude: 35.17,
      longitude: 33.36,
      clinic_place_id: "place-1",
      is_archived: false,
    },
    ...partial,
  };
}

describe("professional clinic locations", () => {
  it("selects the join row's schedule and the clinic's address", () => {
    assert.equal(PROFESSIONAL_CLINIC_LOCATION_SELECT.includes("slot_duration_minutes"), true);
    assert.equal(PROFESSIONAL_CLINIC_LOCATION_SELECT.includes("weekly_schedule"), true);
    assert.equal(PROFESSIONAL_CLINIC_LOCATION_SELECT.includes("clinics ("), true);
    assert.equal(PROFESSIONAL_CLINIC_LOCATION_SELECT.includes("address"), true);
  });

  it("maps a join row onto the location shape every caller renders", () => {
    const location = professionalClinicRowToLocation(joinRow());
    assert.deepEqual(location, {
      // The join-row id IS the location id (Stage 1 invariant), so ?location=<uuid>
      // links and appointments.location_id keep resolving.
      id: "join-1",
      doctor_id: "pro-1",
      is_primary: true,
      sort_order: 0,
      label: "Evenings",
      district: "Nicosia",
      clinic_address: "Makariou Avenue 10, Nicosia 1065, Cyprus",
      town: "Nicosia",
      latitude: 35.17,
      longitude: 33.36,
      clinic_place_id: "place-1",
      pause_online_bookings: false,
      monday: true,
      tuesday: false,
      wednesday: true,
      thursday: false,
      friday: true,
      saturday: false,
      sunday: false,
      start_time: "10:00:00",
      end_time: "18:00:00",
      weekly_schedule: null,
      break_start: "13:00:00",
      break_end: "14:00:00",
      slot_duration_minutes: 45,
      created_at: "2026-09-01T10:00:00Z",
      updated_at: "2026-09-02T10:00:00Z",
    });
  });

  it("accepts the array shape PostgREST returns for a to-one embed", () => {
    const row = joinRow();
    const asArray = { ...row, clinics: [row.clinics] } as ProfessionalClinicJoinRow;
    assert.equal(
      professionalClinicRowToLocation(asArray).clinic_address,
      "Makariou Avenue 10, Nicosia 1065, Cyprus",
    );
  });

  it("falls back to the doctor_locations defaults when the join row has no schedule", () => {
    // Scraped listings carry NULL schedules. A registered professional's rows are
    // mirrored, but the mapping must never emit NULL where the type promises a value.
    const location = professionalClinicRowToLocation(
      joinRow({
        label: null,
        pause_online_bookings: null,
        monday: null,
        tuesday: null,
        wednesday: null,
        thursday: null,
        friday: null,
        saturday: null,
        sunday: null,
        start_time: null,
        end_time: null,
        break_start: null,
        break_end: null,
        slot_duration_minutes: null,
        is_primary: null,
        sort_order: null,
      }),
    );
    assert.equal(location.start_time, "09:00:00");
    assert.equal(location.end_time, "17:00:00");
    assert.equal(location.slot_duration_minutes, 30);
    assert.equal(location.pause_online_bookings, true, "never open bookings by accident");
    assert.equal(location.is_primary, false);
    assert.equal(location.sort_order, 0);
    assert.equal(location.monday, false);
    assert.equal(location.label, null);
  });

  it("drops a join row whose clinic is missing or archived", () => {
    assert.equal(professionalClinicRowToLocation(joinRow({ clinics: null })), null);
    assert.equal(
      professionalClinicRowToLocation(
        joinRow({ clinics: { ...joinRow().clinics!, is_archived: true } }),
      ),
      null,
    );
  });

  it("keeps a clinic with no address, so a half-filled profile still lists it", () => {
    const location = professionalClinicRowToLocation(
      joinRow({ clinics: { ...joinRow().clinics!, address: null, town: null } }),
    );
    assert.equal(location?.clinic_address, null);
    assert.equal(location?.district, "Nicosia");
  });
});
