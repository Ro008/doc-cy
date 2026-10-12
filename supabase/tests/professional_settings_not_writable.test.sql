-- Database test for migration *_professional_settings_not_writable: a session reads
-- professional_settings but cannot write it; the server (service role) still can.
--
-- Run against TESTING only. Always rolls back: the final error message is the result.

do $test$
declare
  v_priv text;
  v_checks int := 0;
begin
  foreach v_priv in array array['insert', 'update', 'delete', 'truncate'] loop
    assert not has_table_privilege('authenticated', 'public.professional_settings', v_priv),
      format('FAIL: a session cannot %s professional_settings', v_priv);
    assert not has_table_privilege('anon', 'public.professional_settings', v_priv),
      format('FAIL: anon cannot %s professional_settings', v_priv);
    assert has_table_privilege('service_role', 'public.professional_settings', v_priv),
      format('FAIL: the server can %s professional_settings', v_priv);
    v_checks := v_checks + 3;
  end loop;
  assert has_table_privilege('authenticated', 'public.professional_settings', 'select')
    and has_table_privilege('anon', 'public.professional_settings', 'select'),
    'FAIL: professional_settings stays readable';
  v_checks := v_checks + 1;
  raise exception 'ALL professional_settings_not_writable TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;
