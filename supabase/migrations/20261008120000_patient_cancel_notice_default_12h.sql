-- Patients can cancel online until 12 h before the visit by default (was 24 h). Agreed by
-- Rocío and Livio on 2026-10-08: the visit reminder goes out 24 h before, so with 12 h it still
-- carries the cancel link. Professionals choose 12 / 24 / 48 in Settings (new on the same day).
-- Until then nobody could choose, so every stored value is the old default: move them to 12.

alter table public.professional_settings
  alter column patient_cancel_notice_hours set default 12;

update public.professional_settings
  set patient_cancel_notice_hours = 12
  where patient_cancel_notice_hours = 24;
