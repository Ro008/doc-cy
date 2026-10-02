-- Point E1: the monthly digest is removed (no automatic emails to professionals for now;
-- a new digest will be designed on user_events). Its send log goes with it.
-- Backward-compatible once the code that wrote it is gone: apply to Production after merge.
do $$
declare
  v_has_rows boolean;
begin
  if to_regclass('public.professional_monthly_digest_sent') is not null then
    -- Dynamic: a static reference fails to plan once the table is gone (re-runs).
    execute 'select exists (select 1 from public.professional_monthly_digest_sent)' into v_has_rows;
    if v_has_rows then
      raise exception 'professional_monthly_digest_sent has rows: check before dropping';
    end if;
  end if;
end
$$;

drop table if exists public.professional_monthly_digest_sent;
