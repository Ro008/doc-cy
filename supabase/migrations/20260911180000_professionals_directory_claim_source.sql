-- Persist how a signup converted (or did not convert) a finder listing.
-- Used by the founder pending-registration review labels.
-- Values: card_link | email | name_specialty_district | NULL (no convert).

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS directory_claim_source text;

ALTER TABLE public.professionals
  DROP CONSTRAINT IF EXISTS professionals_directory_claim_source_check;

ALTER TABLE public.professionals
  ADD CONSTRAINT professionals_directory_claim_source_check
  CHECK (
    directory_claim_source IS NULL
    OR directory_claim_source IN ('card_link', 'email', 'name_specialty_district')
  );

COMMENT ON COLUMN public.professionals.directory_claim_source IS
  'How this registered row converted an unregistered finder listing at signup: card_link (Activate online booking), email, or name_specialty_district. NULL when signup inserted a new row.';
