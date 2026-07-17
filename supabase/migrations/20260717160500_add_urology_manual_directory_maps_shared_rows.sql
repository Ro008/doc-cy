-- Append Urology rows skipped by shared Maps URL dedupe (new_toUPLOAD_urologist_CLEANED.xlsx).
-- Only inserts name+specialty+district combinations not already present.

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
    ('Costas Constantinou', 'Urology', 'Limassol', 'https://maps.google.com/?cid=405158547416564189&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 814141', 34.6872174, 33.0396164, 'costas-constantinou-urology-limassol'),
    ('Martha Ntoumanidou', 'Urology', 'Limassol', 'https://maps.google.com/?cid=3394320437579062486&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 165777', 34.6915334, 33.0313553999999, 'martha-ntoumanidou-urology-limassol'),
    ('Michalis Kounounis', 'Urology', 'Limassol', 'https://maps.google.com/?cid=5947417707715545457&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 818150', 34.6852748999999, 33.0316849, 'michalis-kounounis-urology-limassol'),
    ('Panagiotis Vagianas', 'Urology', 'Limassol', 'https://maps.google.com/?cid=13946925767859619719&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 574800', 34.7002886, 33.0763263, 'panagiotis-vagianas-urology-limassol'),
    ('Tatiana Polycarpou', 'Urology', 'Limassol', 'https://maps.google.com/?cid=2047369797872418396&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 747148', 34.6886443, 33.0303616, 'tatiana-polycarpou-urology-limassol'),
    ('Androula Patriotou', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=6510224007197496936&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 777313', 35.16547, 33.3663271, 'androula-patriotou-urology-nicosia'),
    ('Elina Nikolenco', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=9761980296293198068&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 348333', 35.1697979, 33.3737454, 'elina-nikolenco-urology-nicosia'),
    ('Tanos Vasilios', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=5793088455925542697&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 200629', 35.1394374, 33.3640925, 'tanos-vasilios-urology-nicosia'),
    ('Yerasimos Kyriakides', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=16441495184618580201&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 332120', 35.1423826, 33.3602589, 'yerasimos-kyriakides-urology-nicosia'),
    ('Andreas Matheou', 'Urology', 'Paphos', 'https://maps.google.com/?cid=1924018405602862864&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 055649', 34.7628002, 32.4384926, 'andreas-matheou-urology-paphos'),
    ('Costas Papadopoulos', 'Urology', 'Paphos', 'https://maps.google.com/?cid=6807476521644262520&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 675455', 34.787272, 32.4393366, 'costas-papadopoulos-urology-paphos')
) as v(name, specialty, district, address_maps_link, phone, latitude, longitude, slug)
where not exists (
  select 1
  from public.directory_manual d
  where d.is_archived = false
    and lower(d.name) = lower(v.name)
    and d.district = v.district::public.cyprus_district
    and lower(trim(d.specialty)) = lower(trim(v.specialty))
);
