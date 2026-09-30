-- Database test for the canary fake clinics (migration *_canary_fake_clinics).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Read-only: the final error message is the result. "ALL canary_clinics TESTS
-- PASSED (…)" means success; any "FAIL: …" names the broken rule.

do $test$
declare
  v_canaries int;
  v_clinics int;
  v_linked int;
  v_phone int;
  v_shared int;
begin
  select count(*) into v_canaries
  from public.professionals
  where id::text like 'c04180_0-d0cc-4a01-800_-cafebabe000_';

  if v_canaries = 0 then
    raise exception 'FAIL: no canary professionals found (wrong database?)';
  end if;

  -- One fake clinic per canary, linked as its primary clinic.
  select count(*) into v_linked
  from public.professionals p
  join public.professional_clinics pc on pc.professional_id = p.id and pc.is_primary
  join public.clinics c on c.id = pc.clinic_id
  where p.id::text like 'c04180_0-d0cc-4a01-800_-cafebabe000_'
    and c.id::text like 'c041801_-d0cc-4a01-900_-cafebabe100_'
    and not c.is_archived;
  if v_linked <> v_canaries then
    raise exception 'FAIL: % of % canaries have their own primary fake clinic', v_linked, v_canaries;
  end if;

  -- Each fake clinic has exactly one link, no GeSY code, an address and coordinates.
  select count(*) into v_clinics
  from public.clinics c
  where c.id::text like 'c041801_-d0cc-4a01-900_-cafebabe100_'
    and c.ghs_code is null
    and coalesce(c.address, '') <> ''
    and c.latitude is not null and c.longitude is not null
    and (select count(*) from public.professional_clinics x where x.clinic_id = c.id) = 1;
  if v_clinics <> v_canaries then
    raise exception 'FAIL: only % of % fake clinics are well formed', v_clinics, v_canaries;
  end if;

  -- The clinic carries the reserved phone (8 digits, like every clinic phone).
  select count(*) into v_phone
  from public.professionals p
  join public.professional_clinics pc on pc.professional_id = p.id
  join public.clinics c on c.id = pc.clinic_id
  where p.id::text like 'c04180_0-d0cc-4a01-800_-cafebabe000_'
    and c.phone = right(regexp_replace(p.phone, '\D', '', 'g'), 8)
    and c.phone ~ '^990418(0[1-6])$';
  if v_phone <> v_canaries then
    raise exception 'FAIL: % of % fake clinics carry their reserved phone', v_phone, v_canaries;
  end if;

  -- Canaries stay unregistered listings; no other professional is linked to a fake clinic.
  select count(*) into v_shared
  from public.professional_clinics pc
  where pc.clinic_id::text like 'c041801_-d0cc-4a01-900_-cafebabe100_'
    and pc.professional_id::text not like 'c04180_0-d0cc-4a01-800_-cafebabe000_';
  if v_shared <> 0 then
    raise exception 'FAIL: % non-canary professionals are linked to a fake clinic', v_shared;
  end if;

  raise exception 'ALL canary_clinics TESTS PASSED (% canaries)', v_canaries;
end
$test$;
