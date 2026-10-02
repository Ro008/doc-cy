-- Database tests for the clinic rule (migration *_clinics_require_phone_address):
-- an active clinic always has an address and an 8-digit phone. Archived clinics are exempt.
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL clinics_require_phone_address TESTS PASSED (…)" means success;
-- any "FAIL: …" names the broken rule. Nothing is left behind.

create or replace function pg_temp.expect_error(p_sql text, p_state text, p_label text)
returns void
language plpgsql
as $f$
begin
  execute p_sql;
  raise exception 'FAIL: % (expected SQLSTATE %, but it succeeded)', p_label, p_state;
exception
  when others then
    if sqlerrm like 'FAIL:%' then
      raise;
    end if;
    if sqlstate <> p_state then
      raise exception 'FAIL: % (expected SQLSTATE %, got %: %)', p_label, p_state, sqlstate, sqlerrm;
    end if;
end
$f$;

do $test$
declare
  v_tag text := substr(md5(random()::text), 1, 8);
  v_ok uuid;
  v_checks int := 0;
begin
  -- 1. A complete active clinic is accepted.
  insert into public.clinics (name, slug, district, address, phone)
  values ('Rule OK ' || v_tag, 'rule-ok-' || v_tag, 'Paphos', '1 Test St, Paphos', '26123456')
  returning id into v_ok;
  v_checks := v_checks + 1;

  -- 2. An active clinic needs a phone: missing, blank, wrong length, or not digits.
  perform pg_temp.expect_error(
    format($q$insert into public.clinics (name, slug, district, address) values ('No phone', 'rule-np-%s', 'Paphos', '1 St')$q$, v_tag),
    '23514', 'insert without a phone');
  perform pg_temp.expect_error(
    format($q$insert into public.clinics (name, slug, district, address, phone) values ('Blank phone', 'rule-bp-%s', 'Paphos', '1 St', '  ')$q$, v_tag),
    '23514', 'insert with a blank phone');
  perform pg_temp.expect_error(
    format($q$insert into public.clinics (name, slug, district, address, phone) values ('Short phone', 'rule-sp-%s', 'Paphos', '1 St', '2612345')$q$, v_tag),
    '23514', 'insert with a 7-digit phone');
  perform pg_temp.expect_error(
    format($q$insert into public.clinics (name, slug, district, address, phone) values ('Run together', 'rule-rt-%s', 'Paphos', '1 St', '2255069222444444')$q$, v_tag),
    '23514', 'insert with two numbers run together');
  perform pg_temp.expect_error(
    format($q$insert into public.clinics (name, slug, district, address, phone) values ('Spaced phone', 'rule-xp-%s', 'Paphos', '1 St', '+35726123456')$q$, v_tag),
    '23514', 'insert with a +357 phone');
  v_checks := v_checks + 1;

  -- 3. An active clinic needs an address (missing or blank).
  perform pg_temp.expect_error(
    format($q$insert into public.clinics (name, slug, district, phone) values ('No address', 'rule-na-%s', 'Paphos', '26123456')$q$, v_tag),
    '23514', 'insert without an address');
  perform pg_temp.expect_error(
    format($q$insert into public.clinics (name, slug, district, address, phone) values ('Blank address', 'rule-ba-%s', 'Paphos', '   ', '26123456')$q$, v_tag),
    '23514', 'insert with a blank address');
  v_checks := v_checks + 1;

  -- 4. The rule also holds on update, and when an archived clinic comes back.
  perform pg_temp.expect_error(
    format($q$update public.clinics set phone = null where id = %L$q$, v_ok),
    '23514', 'update the phone to null');
  perform pg_temp.expect_error(
    format($q$update public.clinics set address = '' where id = %L$q$, v_ok),
    '23514', 'update the address to blank');
  v_checks := v_checks + 1;

  -- 5. Archived clinics are exempt (GeSY history keeps its rows), but cannot be restored incomplete.
  insert into public.clinics (name, slug, district, is_archived)
  values ('Archived ' || v_tag, 'rule-arch-' || v_tag, 'Paphos', true);
  perform pg_temp.expect_error(
    format($q$update public.clinics set is_archived = false where slug = 'rule-arch-%s'$q$, v_tag),
    '23514', 'unarchive a clinic without phone and address');
  update public.clinics set is_archived = true where id = v_ok;
  update public.clinics set phone = null where id = v_ok;
  v_checks := v_checks + 1;

  raise exception 'ALL clinics_require_phone_address TESTS PASSED (% checks)', v_checks;
end
$test$;
