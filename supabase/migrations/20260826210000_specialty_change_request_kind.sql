-- Distinguish add vs replace specialty requests from settings.

alter table public.doctor_specialty_change_requests
  add column if not exists request_kind text not null default 'add';

alter table public.doctor_specialty_change_requests
  drop constraint if exists doctor_specialty_change_requests_request_kind_check;

alter table public.doctor_specialty_change_requests
  add constraint doctor_specialty_change_requests_request_kind_check
  check (request_kind in ('add', 'replace'));

-- from_specialty is required for replace; optional/empty for add.
alter table public.doctor_specialty_change_requests
  alter column from_specialty drop not null;

update public.doctor_specialty_change_requests
set from_specialty = nullif(btrim(from_specialty), '')
where request_kind = 'add';

comment on column public.doctor_specialty_change_requests.request_kind is
  'add = new specialty alongside existing; replace = swap from_specialty for to_specialty.';
