-- Remove Dermatology manual listings that were never linked to a GeSY ghs_code.
-- Runs after 20260722193000_gesy_dermatology_enrich_and_insert.sql.
-- Cascades to directory_manual_patient_booking_requests / duplicate suggestions.

delete from public.directory_manual
where specialty = 'Dermatology'
  and is_archived = false
  and (ghs_code is null or btrim(ghs_code) = '');
