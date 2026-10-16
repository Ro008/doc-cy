-- Review moderation (user, 2026-10-15): founders check every patient review before it
-- shows, so it uses proper language and doesn't advertise anything.
--
-- professional_reviews.status:
--   pending   new review, waiting for a founder (the new default);
--   published approved: on the profile and in the finder's rating;
--   rejected  refused, final: never shown, nobody is told;
--   hidden    taken down after being published (unchanged).
-- moderated_at / moderated_by: when and which admin approved or rejected it (both or neither;
-- admins are deactivated, never deleted, so the name stays).
--
-- Backward-compatible: the running code inserts without a status (it gets 'pending' and
-- simply doesn't show until approved) and the public pages already read 'published' only.
-- Existing rows keep their status (Production has none). Idempotent.
-- Test: supabase/tests/professional_reviews_moderation.test.sql.

alter table public.professional_reviews
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid;

alter table public.professional_reviews
  alter column status set default 'pending';

alter table public.professional_reviews
  drop constraint if exists professional_reviews_status_check;
alter table public.professional_reviews
  add constraint professional_reviews_status_check
  check (status in ('pending', 'published', 'rejected', 'hidden'));

alter table public.professional_reviews
  drop constraint if exists professional_reviews_moderated_by_fkey;
alter table public.professional_reviews
  add constraint professional_reviews_moderated_by_fkey
  foreign key (moderated_by) references public.admin_users (id) on delete restrict;

alter table public.professional_reviews
  drop constraint if exists professional_reviews_moderated_pair_check;
alter table public.professional_reviews
  add constraint professional_reviews_moderated_pair_check
  check ((moderated_at is null) = (moderated_by is null));

-- The founders' queue: pending reviews, oldest first.
create index if not exists professional_reviews_pending_idx
  on public.professional_reviews (created_at)
  where status = 'pending';

comment on table public.professional_reviews is
  'One review per attended visit. Founders approve (published) or reject each one first; new ones are pending. Public display: published only, first name + last initial, never reviewer_email. Service role only.';
