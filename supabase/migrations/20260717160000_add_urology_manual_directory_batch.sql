-- Append manual directory rows from spreadsheet (new_toUPLOAD_urologist_CLEANED.xlsx).

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
    ('Constantinos Tryfonos', 'Urology', 'Larnaca', 'https://maps.google.com/?cid=12404393122370224693&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.931369, 33.6162219, 'constantinos-tryfonos-larnaca'),
    ('Marinella Kyriakidou-Himonas', 'Urology', 'Larnaca', 'https://maps.google.com/?cid=12805918768151220325&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 818681', 34.9166057, 33.6064292, 'marinella-kyriakidou-himonas-larnaca'),
    ('Andreas Demetriades', 'Urology', 'Limassol', 'https://maps.google.com/?cid=17589239513929331999&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 777774', 35.1138654999999, 33.3813479999999, 'andreas-demetriades-limassol'),
    ('Angelos Achilleos', 'Urology', 'Limassol', 'https://maps.google.com/?cid=17324996650873330532&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 386262', 34.6814627, 33.0412429, 'angelos-achilleos-limassol'),
    ('Christos Pontikis', 'Urology', 'Limassol', 'https://maps.google.com/?cid=4582120115175817173&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '94 058161', 34.6886043999999, 33.0103481, 'christos-pontikis-limassol'),
    ('Costas Constantinou', 'Urology', 'Limassol', 'https://maps.google.com/?cid=405158547416564189&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 814141', 34.6872174, 33.0396164, 'costas-constantinou-limassol'),
    ('Costas Philippou', 'Urology', 'Limassol', 'https://maps.google.com/?cid=12749974122350142860&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 712052', 35.1394872, 33.3644074, 'costas-philippou-limassol'),
    ('George Zavros', 'Urology', 'Limassol', 'https://maps.google.com/?cid=11180422851819499190&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 760027', 34.6830013, 33.0481306, 'george-zavros-limassol'),
    ('Grigorios Tzagidis', 'Urology', 'Limassol', 'https://maps.google.com/?cid=18128182735302210259&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '95 707001', 34.7002990999999, 33.0763294, 'grigorios-tzagidis-limassol'),
    ('Ioannis Christodoulidis', 'Urology', 'Limassol', 'https://maps.google.com/?cid=16820091113138072195&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 730007', 34.7052888, 33.0304924, 'ioannis-christodoulidis-limassol'),
    ('Ioannis Papazoglou', 'Urology', 'Limassol', 'https://maps.google.com/?cid=3322456089801090213&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 476625', 35.1220572, 33.341508, 'ioannis-papazoglou-limassol'),
    ('Kostas Konstantinou', 'Urology', 'Limassol', 'https://maps.google.com/?cid=398055573798944358&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 780003', 34.7100495, 33.0770577, 'kostas-konstantinou-limassol'),
    ('Marinos Xenofontos', 'Urology', 'Limassol', 'https://maps.google.com/?cid=11618649902477731087&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 346345', 34.6864829, 33.0443175, 'marinos-xenofontos-limassol'),
    ('Marios Hadjipavlou', 'Urology', 'Limassol', 'https://maps.google.com/?cid=7557297862030134922&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 444444', 35.1467202, 33.3531708999999, 'marios-hadjipavlou-limassol'),
    ('Martha Ntoumanidou', 'Urology', 'Limassol', 'https://maps.google.com/?cid=3394320437579062486&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 165777', 34.6915334, 33.0313553999999, 'martha-ntoumanidou-limassol'),
    ('Michael Koursaros', 'Urology', 'Limassol', 'https://maps.google.com/?cid=4507624237986470808&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 383111', 34.6852843, 33.0394893, 'michael-koursaros-limassol'),
    ('Michalis Kounounis', 'Urology', 'Limassol', 'https://maps.google.com/?cid=5947417707715545457&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 818150', 34.6852748999999, 33.0316849, 'michalis-kounounis-limassol'),
    ('Michalis Varnava', 'Urology', 'Limassol', 'https://maps.google.com/?cid=16161955721887903990&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 377531', 34.6817184, 33.0348903, 'michalis-varnava-limassol'),
    ('Nikolaos Tsatsanidis', 'Urology', 'Limassol', 'https://maps.google.com/?cid=8589469212417980669&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 706548', 34.6827793, 33.0407823, 'nikolaos-tsatsanidis-limassol'),
    ('Panagiotis Vagianas', 'Urology', 'Limassol', 'https://maps.google.com/?cid=13946925767859619719&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 574800', 34.7002886, 33.0763263, 'panagiotis-vagianas-limassol'),
    ('Petros Epaminonda Christou', 'Urology', 'Limassol', 'https://maps.google.com/?cid=5763563046476783959&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 001170', 34.9296539, 33.6312725999999, 'petros-epaminonda-christou-limassol'),
    ('Stefanos Perikleous', 'Urology', 'Limassol', 'https://maps.google.com/?cid=11542041333407986043&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '95 907720', 34.9905308, 33.9786596, 'stefanos-perikleous-limassol'),
    ('Tatiana Polycarpou', 'Urology', 'Limassol', 'https://maps.google.com/?cid=2047369797872418396&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 747148', 34.6886443, 33.0303616, 'tatiana-polycarpou-limassol'),
    ('Theofanis Melachroinakis', 'Urology', 'Limassol', 'https://maps.google.com/?cid=14201379193882195310&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 377533', 35.16433, 33.3183343, 'theofanis-melachroinakis-limassol'),
    ('Thrasos Macriyiannis', 'Urology', 'Limassol', 'https://maps.google.com/?cid=16396606034494653161&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 362504', 34.6833102999999, 33.0439037999999, 'thrasos-macriyiannis-limassol'),
    ('Vasileios Adamopoulos', 'Urology', 'Limassol', 'https://maps.google.com/?cid=2045759113344659103&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '95 180225', 34.6908798, 32.9609005, 'vasileios-adamopoulos-limassol'),
    ('Vasileios Adamou', 'Urology', 'Limassol', 'https://maps.google.com/?cid=5191642147457525327&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 208518', 34.690002, 33.054356, 'vasileios-adamou-limassol'),
    ('Vasilis Adamou', 'Urology', 'Limassol', 'https://maps.google.com/?cid=11028545656492679623&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 208000', 34.729627, 33.0604625, 'vasilis-adamou-limassol'),
    ('Zaphiro Kyriazi', 'Urology', 'Limassol', 'https://maps.google.com/?cid=192851896380049638&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 847334', 35.1185062, 33.3491151, 'zaphiro-kyriazi-limassol'),
    ('Andreas Christodoulides', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=16898928855810429450&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 338771', 34.9211324, 33.6050457, 'andreas-christodoulides-nicosia'),
    ('Androula Patriotou', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=6510224007197496936&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 777313', 35.16547, 33.3663271, 'androula-patriotou-nicosia'),
    ('Christodoulos Yerosimou', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=6781573759780067717&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 325252', 35.1271889, 33.3235899, 'christodoulos-yerosimou-nicosia'),
    ('Elena Andreou', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=2405751691155257849&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 425100', 35.1412899, 33.3694559, 'elena-andreou-nicosia'),
    ('Elina Nikolenco', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=9761980296293198068&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 348333', 35.1697979, 33.3737454, 'elina-nikolenco-nicosia'),
    ('Emil Mammadov', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=2296449215983196886&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '(0392) 223 61 21', 35.2082744, 33.3347687, 'emil-mammadov-nicosia'),
    ('Floros Irakleous', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=16730226170573819247&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 751762', 35.1663190999999, 33.3695758, 'floros-irakleous-nicosia'),
    ('Iakovos Prastitis', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=7346182780163484126&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 200383', 35.1395981, 33.364534, 'iakovos-prastitis-nicosia'),
    ('Marios Pedonomou', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=4089522099568558659&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 200386', 35.139507, 33.364104, 'marios-pedonomou-nicosia'),
    ('Necmi Bayraktar', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=17076846757250248796&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '0533 835 90 00', 35.3362684999999, 33.3282776, 'necmi-bayraktar-nicosia'),
    ('Panagiotis Sakkas', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=14799773461414868409&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 694600', 34.9165748, 33.6259971, 'panagiotis-sakkas-nicosia'),
    ('Savvas Kadis', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=17491258141385148548&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 712161', 35.1391975, 33.3651036, 'savvas-kadis-nicosia'),
    ('Savvas Omorphos', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=7600918262795401649&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 502024', 35.1657078, 33.3294373999999, 'savvas-omorphos-nicosia'),
    ('Tanos Vasilios', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=5793088455925542697&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 200629', 35.1394374, 33.3640925, 'tanos-vasilios-nicosia'),
    ('Vadim Kotsidis', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=13212754940548299298&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 780780', 35.1691606, 33.3446163, 'vadim-kotsidis-nicosia'),
    ('Yerasimos Kyriakides', 'Urology', 'Nicosia', 'https://maps.google.com/?cid=16441495184618580201&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 332120', 35.1423826, 33.3602589, 'yerasimos-kyriakides-nicosia'),
    ('Andreas Matheou', 'Urology', 'Paphos', 'https://maps.google.com/?cid=1924018405602862864&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 055649', 34.7628002, 32.4384926, 'andreas-matheou-paphos'),
    ('Costas Papadopoulos', 'Urology', 'Paphos', 'https://maps.google.com/?cid=6807476521644262520&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 675455', 34.787272, 32.4393366, 'costas-papadopoulos-paphos'),
    ('Giannis Kesidis', 'Urology', 'Paphos', 'https://maps.google.com/?cid=10459935593846353182&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 879840', 34.7861539999999, 32.4371248, 'giannis-kesidis-paphos'),
    ('Stavros Charalampous', 'Urology', 'Paphos', 'https://maps.google.com/?cid=1095585317598748248&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 587711', 34.6923376999999, 33.0630194999999, 'stavros-charalampous-paphos'),
    ('Vasileios Adamopoulos', 'Urology', 'Paphos', 'https://maps.google.com/?cid=13283515194364156142&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '95 180225', 34.7865762, 32.4379999999999, 'vasileios-adamopoulos-paphos'),
    ('Vasileios Adamou', 'Urology', 'Paphos', 'https://maps.google.com/?cid=13424371999347048960&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 803428', 34.7878792, 32.4448296, 'vasileios-adamou-paphos')
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
