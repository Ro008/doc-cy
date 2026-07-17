-- Append manual directory rows from spreadsheet (new_toUPLOAD_ENT_CLEANED.xlsx).

alter table public.directory_manual
  add column if not exists phone text;

alter table public.directory_manual
  add column if not exists slug text;

insert into public.directory_manual (
  name,
  specialty,
  district,
  address_maps_link,
  phone,
  latitude,
  longitude,
  slug
)
select
  v.name,
  v.specialty,
  v.district::public.cyprus_district,
  v.address_maps_link,
  v.phone,
  v.latitude,
  v.longitude,
  v.slug
from (
  values
    ('Marilia Sapountzi', 'ENT', 'Larnaca', 'https://maps.google.com/?cid=4292929221360103953&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '94 056706', 34.990482, 33.978573, 'marilia-sapountzi-larnaca'),
    ('Christos Menelaou', 'ENT', 'Limassol', 'https://maps.google.com/?cid=9640945602079496284&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 279972', 35.1409936999999, 33.3381682, 'christos-menelaou-limassol'),
    ('Georgios Gatsios', 'ENT', 'Limassol', 'https://maps.google.com/?cid=11445168557510277096&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 490780', 34.6773063, 33.0230582999999, 'georgios-gatsios-limassol'),
    ('Panagiota Kosmidou', 'ENT', 'Limassol', 'https://maps.google.com/?cid=2689300822799541036&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 200226', 34.7054709, 33.0269836999999, 'panagiota-kosmidou-limassol'),
    ('Andreas Antoniades', 'ENT', 'Paphos', 'https://maps.google.com/?cid=4104863212618550156&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 675355', 34.7747531, 32.4282548, 'andreas-antoniades-paphos'),
    ('Andreas Ellinas', 'ENT', 'Paphos', 'https://maps.google.com/?cid=291655548582998840&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 840840', 34.9245331, 33.6167935, 'andreas-ellinas-paphos'),
    ('Andreas Ktenas', 'ENT', 'Paphos', 'https://maps.google.com/?cid=8590035193615968459&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 514444', 35.1649905999999, 33.3301413999999, 'andreas-ktenas-paphos'),
    ('Antonis Pieris', 'ENT', 'Paphos', 'https://maps.google.com/?cid=8162627076354247582&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 656666', 34.9171741, 33.6301693, 'antonis-pieris-paphos'),
    ('Christos Loizou', 'ENT', 'Paphos', 'https://maps.google.com/?cid=16472491492744569497&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 334327', 34.6762062, 33.0067975, 'christos-loizou-paphos'),
    ('Christos Shaelos', 'ENT', 'Paphos', 'https://maps.google.com/?cid=16635484719949314083&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 780780', 35.1690472999999, 33.3444188, 'christos-shaelos-paphos'),
    ('Firas Khalil', 'ENT', 'Paphos', 'https://maps.google.com/?cid=3745465800098471097&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 100700', 34.6820856, 33.0406861999999, 'firas-khalil-paphos'),
    ('George Papanastasiou', 'ENT', 'Paphos', 'https://maps.google.com/?cid=1115828998970874451&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 676791', 35.1617653, 33.3541405, 'george-papanastasiou-paphos'),
    ('George Savva', 'ENT', 'Paphos', 'https://maps.google.com/?cid=5951564422077216470&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 337001', 34.6962257, 33.0313483, 'george-savva-paphos'),
    ('Georgios Ioannides', 'ENT', 'Paphos', 'https://maps.google.com/?cid=10292169043135134781&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 250202', 34.6840675, 33.0409225, 'georgios-ioannides-paphos'),
    ('Ioannis Theodosiou', 'ENT', 'Paphos', 'https://maps.google.com/?cid=13854630565644217589&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 505620', 34.9079021, 33.6275216, 'ioannis-theodosiou-paphos'),
    ('Katerina Panagiotidi', 'ENT', 'Paphos', 'https://maps.google.com/?cid=2018903105639404599&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 200220', 34.7053134, 33.0283351, 'katerina-panagiotidi-paphos'),
    ('Katerina Taki', 'ENT', 'Paphos', 'https://maps.google.com/?cid=4219759137348259443&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 003227', 34.6946596999999, 33.0268426, 'katerina-taki-paphos'),
    ('Kyriaki Sevastidou', 'ENT', 'Paphos', 'https://maps.google.com/?cid=6048412284247789154&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 272282', 35.1236505, 33.3210598, 'kyriaki-sevastidou-paphos'),
    ('Maria Kazantzi', 'ENT', 'Paphos', 'https://maps.google.com/?cid=13883858842333492872&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 660550', 34.9305212999999, 33.6228288, 'maria-kazantzi-paphos'),
    ('Mattheos Philippou', 'ENT', 'Paphos', 'https://maps.google.com/?cid=17433453769246266568&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 892331', 34.7862805, 32.4373657, 'mattheos-philippou-paphos'),
    ('Michalis Kounounis', 'ENT', 'Paphos', 'https://maps.google.com/?cid=5947417707715545457&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 818150', 34.6852748999999, 33.0316849, 'michalis-kounounis-paphos'),
    ('Panayiotis Kerimis', 'ENT', 'Paphos', 'https://maps.google.com/?cid=17653822834551012864&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 351100', 34.6835203, 33.0380435, 'panayiotis-kerimis-paphos'),
    ('Paris Papakostas', 'ENT', 'Paphos', 'https://maps.google.com/?cid=797598780727624263&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 730269', 35.1708798999999, 33.3546147, 'paris-papakostas-paphos'),
    ('Stephan Engel', 'ENT', 'Paphos', 'https://maps.google.com/?cid=13042213272207205025&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 898960', 34.7766276, 32.4430076999999, 'stephan-engel-paphos'),
    ('Tasos Matsagkos', 'ENT', 'Paphos', 'https://maps.google.com/?cid=5133699754464697609&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 665555', 34.9166168, 33.6220597, 'tasos-matsagkos-paphos'),
    ('Vasileios Manettas', 'ENT', 'Paphos', 'https://maps.google.com/?cid=2367894953213072834&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '94 058759', 34.7867266999999, 32.4379415, 'vasileios-manettas-paphos'),
    ('Yerasimos Kyriakides', 'ENT', 'Paphos', 'https://maps.google.com/?cid=16441495184618580201&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 332120', 35.1423826, 33.3602589, 'yerasimos-kyriakides-paphos')
) as v(name, specialty, district, address_maps_link, phone, latitude, longitude, slug)
where not exists (
  select 1
  from public.directory_manual d
  where d.is_archived = false
    and ((
      lower(d.name) = lower(v.name)
      and d.district = v.district::public.cyprus_district
      and (
      lower(trim(d.specialty)) = lower(trim(v.specialty))
      or (
        lower(trim(v.specialty)) = 'gynecology'
        and lower(trim(d.specialty)) in (
          'gynecology',
          'obstetrics/ gynecology',
          'gynecologic oncology'
        )
      )
    )) or d.address_maps_link = v.address_maps_link)
);
