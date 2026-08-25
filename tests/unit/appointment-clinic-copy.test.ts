import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appointmentClinicCopy,
  appointmentClinicCopyFromAddress,
  formatAppointmentClinicEmailHtml,
  formatAppointmentClinicEmailText,
} from "../../lib/appointment-clinic-copy";

describe("appointment-clinic-copy", () => {
  it("uses the selected location label and address", () => {
    const clinic = appointmentClinicCopy({
      locations: [
        {
          id: "loc-1",
          label: "City clinic",
          clinic_address: "1 Ledra Street, Nicosia",
          is_primary: true,
          sort_order: 0,
        },
        {
          id: "loc-2",
          label: "Coast clinic",
          clinic_address: "10 Harbour Road, Limassol",
          is_primary: false,
          sort_order: 1,
        },
      ],
      locationId: "loc-2",
      doctorClinicAddressFallback: "Fallback address",
    });

    assert.equal(clinic.clinicName, "Coast clinic");
    assert.equal(clinic.address, "10 Harbour Road, Limassol");
    assert.match(clinic.mapsUrl, /maps\.google\.com/);
    assert.match(clinic.mapsUrl, /Harbour/);
  });

  it("falls back to Clinic N when label is empty", () => {
    const clinic = appointmentClinicCopy({
      locations: [
        {
          id: "loc-1",
          label: null,
          clinic_address: "1 Ledra Street, Nicosia",
          is_primary: true,
          sort_order: 0,
        },
        {
          id: "loc-2",
          label: null,
          clinic_address: "10 Harbour Road, Limassol",
          is_primary: false,
          sort_order: 1,
        },
      ],
      locationId: "loc-2",
    });

    assert.equal(clinic.clinicName, "Clinic 2");
    assert.equal(clinic.address, "10 Harbour Road, Limassol");
  });

  it("renders clickable address in html email block", () => {
    const clinic = appointmentClinicCopyFromAddress({
      clinicName: "Clinic 2",
      address: "10 Harbour Road, Limassol",
    });
    const text = formatAppointmentClinicEmailText(clinic);
    const html = formatAppointmentClinicEmailHtml(clinic);

    assert.match(text, /Clinic: Clinic 2/);
    assert.match(text, /Address: 10 Harbour Road, Limassol/);
    assert.match(html, /Clinic 2/);
    assert.match(html, /href="https:\/\/maps\.google\.com\/\?q=/);
    assert.match(html, /10 Harbour Road, Limassol/);
  });
});
