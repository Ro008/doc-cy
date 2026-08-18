-- Scope Call to Book profile-page source to professionals.
-- Leaves room for clinic_profile_page / lab_profile_page / pharmacy_profile_page later.

alter table public.directory_manual_call_to_book_clicks
  drop constraint if exists directory_manual_call_to_book_clicks_source_chk;

update public.directory_manual_call_to_book_clicks
set source = 'professional_profile_page'
where source in ('professional_landing', 'profile_page');

alter table public.directory_manual_call_to_book_clicks
  add constraint directory_manual_call_to_book_clicks_source_chk
    check (source in ('finder_card', 'professional_profile_page'));
