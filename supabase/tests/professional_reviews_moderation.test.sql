-- Database tests for review moderation (migration *_professional_reviews_moderation).
--
-- Founders check every review before it shows (user, 2026-10-15):
-- - a new review is 'pending' by default;
-- - status is one of pending / published / rejected / hidden;
-- - moderated_by points at an admin_users row;
-- - moderated_at and moderated_by come together.
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL professional_reviews_moderation TESTS PASSED (…)" means
-- success; any "FAIL: …" names the broken rule.

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
  v_checks int := 0;
  v_pro uuid;
  v_appt uuid;
  v_auth uuid := gen_random_uuid();
  v_admin uuid;
  v_review uuid;
  v_status text;
begin
  -- Any professional with a clinic: the rows never outlive this transaction.
  select pc.professional_id into v_pro from public.professional_clinics pc limit 1;
  if v_pro is null then
    raise exception 'FAIL: setup (no professional_clinics row on this database)';
  end if;
  insert into public.appointments (professional_id, patient_name, patient_email, patient_phone, appointment_datetime, status)
  values (v_pro, 'Maria Kyriakou', 'maria@integration.test', '+35799000000', timestamptz '2001-01-01 10:00+00', 'DECLINED')
  returning id into v_appt;
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (v_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'moderation-admin@integration.test', now(), now(), now());
  insert into public.admin_users (auth_user_id, name, email)
  values (v_auth, 'Moderation Admin', 'moderation-admin@integration.test')
  returning id into v_admin;

  -- 1. A new review waits.
  insert into public.professional_reviews (professional_id, appointment_id, rating, comment, reviewer_name, reviewer_email)
  values (v_pro, v_appt, 5, 'Very kind.', 'Maria Kyriakou', 'maria@integration.test')
  returning id, status into v_review, v_status;
  if v_status <> 'pending' then
    raise exception 'FAIL: a new review is %, not pending', v_status;
  end if;
  v_checks := v_checks + 1;

  -- 2. The four statuses are accepted, anything else refused.
  update public.professional_reviews set status = 'published', moderated_at = now(), moderated_by = v_admin where id = v_review;
  update public.professional_reviews set status = 'rejected' where id = v_review;
  update public.professional_reviews set status = 'hidden' where id = v_review;
  update public.professional_reviews set status = 'pending', moderated_at = null, moderated_by = null where id = v_review;
  perform pg_temp.expect_error(format(
    $s$update public.professional_reviews set status = 'approved' where id = %L$s$, v_review),
    '23514', 'status outside pending/published/rejected/hidden');
  v_checks := v_checks + 2;

  -- 3. moderated_by must be an admin.
  perform pg_temp.expect_error(format(
    $s$update public.professional_reviews set moderated_at = now(), moderated_by = %L where id = %L$s$,
    gen_random_uuid(), v_review),
    '23503', 'moderated_by not an admin');
  v_checks := v_checks + 1;

  -- 4. Who and when come together.
  perform pg_temp.expect_error(format(
    $s$update public.professional_reviews set moderated_at = now(), moderated_by = null where id = %L$s$, v_review),
    '23514', 'moderated_at without moderated_by');
  perform pg_temp.expect_error(format(
    $s$update public.professional_reviews set moderated_at = null, moderated_by = %L where id = %L$s$, v_admin, v_review),
    '23514', 'moderated_by without moderated_at');
  v_checks := v_checks + 1;

  -- 5. Still service role only.
  if has_table_privilege('anon', 'public.professional_reviews', 'select')
     or has_table_privilege('authenticated', 'public.professional_reviews', 'select') then
    raise exception 'FAIL: anon/authenticated can read professional_reviews';
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL professional_reviews_moderation TESTS PASSED (% checks)', v_checks;
end
$test$;
