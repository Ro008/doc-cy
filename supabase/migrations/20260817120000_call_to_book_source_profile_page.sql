-- Rename Call to Book source: professional_landing → profile_page
-- (/finder/professional/{slug} directory profile pages).

alter table public.directory_manual_call_to_book_clicks
  drop constraint if exists directory_manual_call_to_book_clicks_source_chk;

update public.directory_manual_call_to_book_clicks
set source = 'profile_page'
where source = 'professional_landing';

alter table public.directory_manual_call_to_book_clicks
  add constraint directory_manual_call_to_book_clicks_source_chk
    check (source in ('finder_card', 'profile_page'));
