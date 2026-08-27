-- Allow remove specialty requests; license / to_specialty optional for remove.

alter table public.doctor_specialty_change_requests
  drop constraint if exists doctor_specialty_change_requests_request_kind_check;

alter table public.doctor_specialty_change_requests
  add constraint doctor_specialty_change_requests_request_kind_check
  check (request_kind in ('add', 'replace', 'remove'));

alter table public.doctor_specialty_change_requests
  alter column to_specialty drop not null;

alter table public.doctor_specialty_change_requests
  alter column license_number drop not null;

comment on column public.doctor_specialty_change_requests.request_kind is
  'add = new specialty; replace = swap from→to; remove = drop from_specialty (only when doctor has 2+).';
