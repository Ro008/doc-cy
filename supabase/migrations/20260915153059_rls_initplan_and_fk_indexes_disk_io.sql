-- Performance Advisor (Disk IO / free-tier): fix auth RLS initplan + missing FK indexes.

-- 0003_auth_rls_initplan: wrap auth.uid() so it is evaluated once per query.
DROP POLICY IF EXISTS professionals_select_own ON public.professionals;
CREATE POLICY professionals_select_own
  ON public.professionals
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = auth_user_id);

DROP POLICY IF EXISTS professionals_update_own ON public.professionals;
CREATE POLICY professionals_update_own
  ON public.professionals
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = auth_user_id)
  WITH CHECK ((select auth.uid()) = auth_user_id);

DROP POLICY IF EXISTS doctor_specialties_select_own ON public.doctor_specialties;
CREATE POLICY doctor_specialties_select_own
  ON public.doctor_specialties
  FOR SELECT
  USING (
    doctor_id IN (
      SELECT p.id
      FROM public.professionals p
      WHERE p.auth_user_id = (select auth.uid())
        AND p.is_registered = true
    )
  );

DROP POLICY IF EXISTS doctor_specialty_change_requests_select_own
  ON public.doctor_specialty_change_requests;
CREATE POLICY doctor_specialty_change_requests_select_own
  ON public.doctor_specialty_change_requests
  FOR SELECT
  USING (
    doctor_id IN (
      SELECT p.id
      FROM public.professionals p
      WHERE p.auth_user_id = (select auth.uid())
        AND p.is_registered = true
    )
  );

DROP POLICY IF EXISTS doctor_services_owner_insert ON public.doctor_services;
CREATE POLICY doctor_services_owner_insert
  ON public.doctor_services
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.id = doctor_services.doctor_id
        AND p.is_registered = true
        AND p.auth_user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS doctor_services_owner_update ON public.doctor_services;
CREATE POLICY doctor_services_owner_update
  ON public.doctor_services
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.id = doctor_services.doctor_id
        AND p.is_registered = true
        AND p.auth_user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.id = doctor_services.doctor_id
        AND p.is_registered = true
        AND p.auth_user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS doctor_services_owner_delete ON public.doctor_services;
CREATE POLICY doctor_services_owner_delete
  ON public.doctor_services
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.id = doctor_services.doctor_id
        AND p.is_registered = true
        AND p.auth_user_id = (select auth.uid())
    )
  );

-- 0001_unindexed_foreign_keys
CREATE INDEX IF NOT EXISTS directory_duplicate_suggestions_doctor_id_idx
  ON public.directory_duplicate_suggestions (doctor_id);

CREATE INDEX IF NOT EXISTS professional_call_to_book_clicks_clinic_id_idx
  ON public.professional_call_to_book_clicks (clinic_id);

CREATE INDEX IF NOT EXISTS professionals_claim_listing_id_idx
  ON public.professionals (claim_listing_id);

-- Present on testing; not yet on production.
DO $$
BEGIN
  IF to_regclass('public.directory_manual_outreach_unsubscribed') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS directory_manual_outreach_unsubscribed_manual_id_idx
      ON public.directory_manual_outreach_unsubscribed (manual_id);
  END IF;
END $$;
