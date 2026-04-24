-- Apply user-confirmed district corrections for recent manual entries.
update public.directory_manual
set
  district = v.district::public.cyprus_district,
  updated_at = now()
from (
  values
    ('Andrie Constantinou', 'Limassol'),
    ('Spyridakis Chrysostomou', 'Paphos'),
    ('Georges Parpas', 'Paphos'),
    ('Konstantinos Mikellidis', 'Paphos'),
    ('Maria Gavrilina', 'Nicosia'),
    ('Nikoletta Chatziapostolou', 'Larnaca')
) as v(name, district)
where lower(public.directory_manual.name) = lower(v.name)
  and public.directory_manual.is_archived = false;
