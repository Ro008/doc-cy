-- Database tests for the clean-up after the settings redesign
-- (migration *_drop_is_primary_and_old_limits).
--
-- - A professional has no "primary clinic" (user, 2026-10-11): professional_clinics.is_primary
--   and its index are gone; the order is sort_order, then created_at.
-- - The three booking limits live on each clinic link (professional_clinics):
--   professional_settings loses its copies, and the temporary trigger that carried a
--   change of them to the clinics goes with them.
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL drop_is_primary_and_old_limits TESTS PASSED (…)" means
-- success; any "FAIL: …" names the broken rule.

create or replace function pg_temp.new_login(p_email text)
returns uuid
language plpgsql
as $f$
declare
  v_u uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_email, now(), now(), now());
  return v_u;
end
$f$;

create or replace function pg_temp.new_clinic(p_name text, p_slug text)
returns uuid
language plpgsql
as $f$
declare
  v_id uuid;
begin
  insert into public.clinics (name, slug, district, address, phone, latitude, longitude)
  values (p_name, p_slug, 'Paphos', '1 ' || p_name || ' St, Paphos', '26123456', 34.77, 32.42)
  returning id into v_id;
  return v_id;
end
$f$;


do $test$
declare
  v_tag text := substr(md5(random()::text), 1, 8);
  v_checks int := 0;
  v_pro uuid;
  v_home uuid;
  v_second uuid;
  v_home_link uuid;
  v_second_link uuid;
  v_names text;
  v_req uuid;
  v_pc public.professional_clinics%rowtype;
begin
  ---------------------------------------------------------------- what is gone
  select string_agg(table_name || '.' || column_name, ', ' order by 1) into v_names
  from information_schema.columns
  where table_schema = 'public'
    and ((table_name = 'professional_clinics' and column_name = 'is_primary')
      or (table_name = 'professional_settings'
          and column_name in ('booking_horizon_days', 'minimum_notice_hours', 'patient_cancel_notice_hours')));
  assert v_names is null, format('FAIL: still there: %s', v_names);
  assert to_regclass('public.professional_clinics_primary_idx') is null,
    'FAIL: the primary-clinic index is gone';
  assert not exists (select 1 from pg_trigger where tgname = 'professional_settings_limits_to_clinics'),
    'FAIL: the temporary limits trigger is gone';
  assert to_regprocedure('public.professional_settings_limits_to_clinics()') is null,
    'FAIL: the temporary limits function is gone';
  assert not exists (
    select 1 from pg_constraint
    where conrelid = 'public.professional_settings'::regclass
      and (pg_get_constraintdef(oid) ilike '%booking_horizon%' or pg_get_constraintdef(oid) ilike '%notice_hours%')
  ), 'FAIL: professional_settings keeps no rule about the limits';
  v_checks := v_checks + 5;

  ---------------------------------------------------------------- what stays
  select string_agg(c, ', ') into v_names
  from unnest(array['professional_id', 'holiday_mode_enabled', 'holiday_start_date', 'holiday_end_date',
                    'show_mobile_on_profile']) c
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'professional_settings' and column_name = c);
  assert v_names is null, format('FAIL: professional_settings lost %s', v_names);
  select string_agg(c, ', ') into v_names
  from unnest(array['sort_order', 'booking_horizon_days', 'minimum_notice_hours', 'patient_cancel_notice_hours']) c
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'professional_clinics' and column_name = c
                      and is_nullable = 'NO');
  assert v_names is null, format('FAIL: professional_clinics lost (or lets empty) %s', v_names);
  assert exists (select 1 from pg_trigger where tgname = 'professional_clinics_keep_one')
    and exists (select 1 from pg_trigger where tgname = 'appointments_keep_cancel_notice'),
    'FAIL: the triggers that are still needed stay';
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- nothing in the database still names them
  select string_agg(p.oid::regprocedure::text, ', ') into v_names
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and (p.prosrc ilike '%is_primary%' or p.prosrc ilike '%professional_settings_limits_to_clinics%'
      or p.prosrc ~* 'ps\.(booking_horizon_days|minimum_notice_hours|patient_cancel_notice_hours)');
  assert v_names is null, format('FAIL: these functions still name what was dropped: %s', v_names);
  select string_agg(c.relname, ', ') into v_names
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
    and pg_get_viewdef(c.oid) ilike '%is_primary%';
  assert v_names is null, format('FAIL: these views still name is_primary: %s', v_names);
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- the paths that touch both tables still work
  update public.request_types
  set limit_count = null, limit_window = null, limit_scope_key = null, wait_after_approval = null;
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Dp Pro', 'dp-pro-' || v_tag, true, pg_temp.new_login('dp-pro-' || v_tag || '@integration.test'),
          'dp-pro-' || v_tag || '@integration.test')
  returning id into v_pro;
  v_home := pg_temp.new_clinic('Dp Home ' || v_tag, 'dp-home-' || v_tag);
  v_second := pg_temp.new_clinic('Dp Second ' || v_tag, 'dp-second-' || v_tag);
  insert into public.professional_clinics (professional_id, clinic_id, sort_order) values (v_pro, v_home, 0)
  returning id into v_home_link;
  insert into public.professional_settings (professional_id) values (v_pro)
  on conflict (professional_id) do nothing;

  -- Joining a clinic: it takes the next place in the order and the default limits.
  perform public.professional_clinic_join(v_pro, v_second);
  select * into v_pc from public.professional_clinics where professional_id = v_pro and clinic_id = v_second;
  v_second_link := v_pc.id;
  assert v_pc.sort_order = 1 and v_pc.booking_horizon_days = 90 and v_pc.minimum_notice_hours = 2
    and v_pc.patient_cancel_notice_hours = 12,
    'FAIL: a joined clinic comes after the others, with the default limits';

  -- Limits change per clinic, recorded, and the other clinic keeps its own.
  v_req := public.professional_clinic_limits_set(v_pro, v_second_link, 30, 24, 48);
  assert v_req is not null
    and (select (booking_horizon_days, minimum_notice_hours, patient_cancel_notice_hours) = (30, 24, 48)
         from public.professional_clinics where id = v_second_link)
    and (select (booking_horizon_days, minimum_notice_hours, patient_cancel_notice_hours) = (90, 2, 12)
         from public.professional_clinics where id = v_home_link),
    'FAIL: limits are saved on the clinic they were set for, and nowhere else';

  -- Holiday mode still saves on professional_settings and leaves the clinics alone.
  v_req := public.professional_holiday_set(v_pro, true,
    ((now() at time zone 'Asia/Nicosia')::date + 10), ((now() at time zone 'Asia/Nicosia')::date + 12));
  assert v_req is not null
    and (select holiday_mode_enabled from public.professional_settings where professional_id = v_pro)
    and (select booking_horizon_days from public.professional_clinics where id = v_second_link) = 30,
    'FAIL: a holiday is saved, and no clinic limit moves';

  -- Leaving keeps the limits she had there in the record.
  v_req := public.professional_clinic_leave(v_pro, v_second_link);
  assert (select before_snapshot -> 'settings' ->> 'booking_horizon_days' from public.request_log where id = v_req) = '30',
    'FAIL: the leave record keeps the limits she had there';
  v_checks := v_checks + 4;

  raise exception 'ALL drop_is_primary_and_old_limits TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;
