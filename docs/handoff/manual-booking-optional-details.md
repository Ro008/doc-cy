# Optional patient details on manual bookings (done: frontend, backend and database)

Branch: `feat/doctor-dashboard`. Decision taken by Rocío (2026-10-06), built with Livio's OK: when the
professional adds a manual booking (phone call or walk-in), only **name, phone and reason** are
required. **First visit, gender, email and date of birth are optional** (checked when filled in).
Online bookings keep requiring everything.

## What changed

- Modal: `components/agenda/ManualBookingFlow.tsx`, rules in `lib/manual-booking-validation.ts`
  (tests `tests/unit/manual-booking-validation.test.ts`). Each field shows its own message.
- Phone rule shared by the modal and the server: `lib/phone-number.ts` (digits and the usual
  separators, optional leading `+` or `(+357)`, 7 to 15 digits).
- Server: `parseBookingPatientFields(raw, "manual")` (`lib/booking-patient-fields.ts`, tests in
  `tests/unit/booking-patient-fields.test.ts`) accepts a missing first visit, gender and birth date
  (stored as `null`) and checks the phone format.
- Database: migration `20261006150000_manual_bookings_optional_patient_details.sql` relaxes
  `appointments_booking_fields_check` so `booking_source = 'manual'` rows may leave
  `patient_gender`, `patient_birthdate` and `is_new_patient` null. No column changed (they were already
  nullable). **Applied on Testing on 2026-10-06; Production gets it with the PR.**

Readers already cope with `null` (`lib/patient-details.ts` leaves missing values out): checked in the
agenda on a manual booking with only name, phone and reason.
