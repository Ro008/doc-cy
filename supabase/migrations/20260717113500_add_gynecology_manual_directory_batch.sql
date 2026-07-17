-- Append manual directory rows from spreadsheet (new_toUPLOAD_Gynecologist_CLEANED.xlsx).

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
    ('Andreas Kavallaris', 'Gynecology', 'Larnaca', 'https://maps.google.com/?cid=781645727768506819&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 376630', 34.9125289, 33.6346561, 'andreas-kavallaris-larnaca'),
    ('Dionysios Polychronidis', 'Gynecology', 'Larnaca', 'https://maps.google.com/?cid=11545555938740226821&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '23 822232', 35.0334716, 33.9780643, 'dionysios-polychronidis-larnaca'),
    ('Dionysis Vaidakis', 'Gynecology', 'Larnaca', 'https://maps.google.com/?cid=11223796120816218868&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 641111', 34.931369, 33.6162219, 'dionysis-vaidakis-larnaca'),
    ('Martha Ntoumanidou', 'Gynecology', 'Larnaca', 'https://maps.google.com/?cid=14456036629380007884&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 165777', 35.0550761, 33.9715846, 'martha-ntoumanidou-larnaca'),
    ('Menelaos Charalambous', 'Gynecology', 'Larnaca', 'https://maps.google.com/?cid=18236106653323651435&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 653232', 34.9167307999999, 33.6339791, 'menelaos-charalambous-larnaca'),
    ('Michalis Petrallis', 'Gynecology', 'Larnaca', 'https://maps.google.com/?cid=9668627355546131670&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 637399', 35.0341869999999, 33.9774731, 'michalis-petrallis-larnaca'),
    ('Savvas Antoniades', 'Gynecology', 'Larnaca', 'https://maps.google.com/?cid=1137374972049616566&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 356637', 34.9136424, 33.6341775, 'savvas-antoniades-larnaca'),
    ('Simos Kyriakidis', 'Gynecology', 'Larnaca', 'https://maps.google.com/?cid=4841890806722649508&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 652000', 34.9167722, 33.6260786, 'simos-kyriakidis-larnaca'),
    ('Stamatios Kastanias', 'Gynecology', 'Larnaca', 'https://maps.google.com/?cid=2001979087994542790&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '23 822232', 35.033859, 33.9779662, 'stamatios-kastanias-larnaca'),
    ('Stavros Zarkadas', 'Gynecology', 'Larnaca', 'https://maps.google.com/?cid=4206120859154873014&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 876769', 34.931369, 33.6162219, 'stavros-zarkadas-larnaca'),
    ('Andreas Theodoulou', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=5689091559266268064&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.7047139, 33.0508626999999, 'andreas-theodoulou-limassol'),
    ('Andrie Constantinou', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=13642656094342011225&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 317474', 34.6811065, 33.0348222, 'andrie-constantinou-limassol'),
    ('Angeliki Mina', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=5110116587899361733&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 000826', 34.6846385, 33.0282045, 'angeliki-mina-limassol'),
    ('Aris Vogiatzis', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=17213773660464392455&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 350030', 34.7047139, 33.0508626999999, 'aris-vogiatzis-limassol'),
    ('Christina Stefanou', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=8551163836604904169&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 904738', 34.6721237, 33.0114399, 'christina-stefanou-limassol'),
    ('Elena Kashintseva-Oruontioti', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=14839141758500333063&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 821054', 34.7051201999999, 33.0508188999999, 'elena-kashintseva-oruontioti-limassol'),
    ('Elli Panagiotou', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=7036131021799090155&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 381277', 34.6811323, 33.0348203, 'elli-panagiotou-limassol'),
    ('Maria Akriola Fachiridou', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=16010362602341912320&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 601221', 34.9167403, 33.6260744, 'maria-akriola-fachiridou-limassol'),
    ('Maria Ioanna Anastassiades', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=3836153004051619899&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 875587', 34.692867, 33.0671308999999, 'maria-ioanna-anastassiades-limassol'),
    ('Marios Liasides', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=15382585629179259669&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 381277', 34.6908256, 33.035014, 'marios-liasides-limassol'),
    ('Maro Petrou', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=15280256458272349294&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 334301', 34.6869486999999, 33.0372938, 'maro-petrou-limassol'),
    ('Martha Ntoumanidou', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=3394320437579062486&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 165777', 34.6915334, 33.0313553999999, 'martha-ntoumanidou-limassol'),
    ('Melina Georgiou Koureos', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=12244235232495644942&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.6852547, 33.0447853999999, 'melina-georgiou-koureos-limassol'),
    ('Melina Georgiou Koureos', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=15580170468483442002&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 747774', 34.6852616, 33.044785, 'melina-georgiou-koureos-limassol-2'),
    ('Michalis Chrysostomou', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=9959050204473530540&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 345550', 34.6825718, 33.0426748, 'michalis-chrysostomou-limassol'),
    ('Minos Solomon', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=16467703162507443791&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.6824894, 33.0394637, 'minos-solomon-limassol'),
    ('Oleg Syrchin', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=85620256971663291&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 652070', 34.6817724, 33.041111, 'oleg-syrchin-limassol'),
    ('Olga Pavlenko', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=1140222421682329957&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 446664', 34.6975026, 33.0492759, 'olga-pavlenko-limassol'),
    ('Panagiota Sakka', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=1735129452279862799&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 565645', 34.6802972, 33.0273624999999, 'panagiota-sakka-limassol'),
    ('Prokopis Kerimis', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=2902923395412060043&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 378383', 34.6814627, 33.0412429, 'prokopis-kerimis-limassol'),
    ('Ria Savvidou', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=12581191501968061298&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.6822795, 33.0405833, 'ria-savvidou-limassol'),
    ('Riana Galinou', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=11789274651212698326&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 763692', 34.6833637999999, 33.0439311, 'riana-galinou-limassol'),
    ('Tatiana Polycarpou', 'Gynecology', 'Limassol', 'https://maps.google.com/?cid=2047369797872418396&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 747148', 34.6886443, 33.0303616, 'tatiana-polycarpou-limassol'),
    ('Alexandros Petrolekas', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=9197282512156808232&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 485507', 35.1672794, 33.3682083, 'alexandros-petrolekas-nicosia'),
    ('Anastasios Tranoulis', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=8601748672613836855&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 502238', 35.1655839999999, 33.3293767, 'anastasios-tranoulis-nicosia'),
    ('Anastasis Anastasiadis', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=17708334368386144040&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 376630', 35.1585495, 33.3674603, 'anastasis-anastasiadis-nicosia'),
    ('Anastasis Anastasiadis', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=11073286562770265317&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 532900', 34.9112182, 33.6191397, 'anastasis-anastasiadis-nicosia-2'),
    ('Andrea Shaelou', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=12765743299491147173&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 377763', 35.1584411, 33.3675728, 'andrea-shaelou-nicosia'),
    ('Andrea Shaelou', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=6826330363458699181&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 376630', 35.1584411, 33.3675728, 'andrea-shaelou-nicosia-2'),
    ('Androula Patriotou', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=6510224007197496936&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 777313', 35.16547, 33.3663271, 'androula-patriotou-nicosia'),
    ('Cahit Cenksoy', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=9177616431174283949&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '0548 888 01 12', 35.1959815999999, 33.3476704, 'cahit-cenksoy-nicosia'),
    ('Charalambos Nicolaou', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=5756487631091026845&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 444444', 35.1467202, 33.3531708999999, 'charalambos-nicolaou-nicosia'),
    ('Costas Christoforou', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=16092534586103636592&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 667626', 34.9298196999999, 33.5995308, 'costas-christoforou-nicosia'),
    ('Emine Efendi', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=14081639908068991403&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '0548 875 40 65', 35.3317221, 33.3087425999999, 'emine-efendi-nicosia'),
    ('Evangelia Andreou', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=7061591804966862252&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 250505', 34.9166057, 33.6064292, 'evangelia-andreou-nicosia'),
    ('Evangelos Iliopoulos', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=4101992917628404893&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 042100', 35.1158256, 33.3331769, 'evangelos-iliopoulos-nicosia'),
    ('George Anastasiou', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=6569317975561599068&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 376630', 35.1584411, 33.3675728, 'george-anastasiou-nicosia'),
    ('Giorgos Georgiou', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=761887521436969012&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 622200', 35.1616436, 33.3321332999999, 'giorgos-georgiou-nicosia'),
    ('Ilia Neophytou', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=6988159797853607079&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 441099', 35.1560759, 33.3718647, 'ilia-neophytou-nicosia'),
    ('Kyriakos Kakoullis', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=4646875652775412996&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 476441', 35.1690472999999, 33.3444188, 'kyriakos-kakoullis-nicosia'),
    ('Magia Athina', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=8444947341731496318&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 376802', 35.1584411, 33.3675728, 'magia-athina-nicosia'),
    ('Maria Akriola Fachiridou', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=4761503271587471456&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 601221', 35.1690472999999, 33.3444188, 'maria-akriola-fachiridou-nicosia'),
    ('Maria Gavrilina', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=6456870756502264725&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 556295', 35.1303173, 33.33846, 'maria-gavrilina-nicosia'),
    ('Nicodemos Christofi', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=8348260044471425316&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 819282', 35.1690549, 33.3444117, 'nicodemos-christofi-nicosia'),
    ('Nicolas Galazis', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=8769508196776439778&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 780780', 35.1690363, 33.3445904999999, 'nicolas-galazis-nicosia'),
    ('Nikoletta Chatziapostolou', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=13233791839007648964&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 505620', 34.9080308, 33.6274915, 'nikoletta-chatziapostolou-nicosia'),
    ('Paris Pariza', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=16643571756565570249&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 780780', 35.169193, 33.3445789, 'paris-pariza-nicosia'),
    ('Savvas Savvas', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=1117543310706919925&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 818599', 35.1592979, 33.3429177999999, 'savvas-savvas-nicosia'),
    ('Stelios Tsangarides', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=12434716417270390315&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 424140', 35.1475967, 33.3192692, 'stelios-tsangarides-nicosia'),
    ('Tanos Vasilios', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=5793088455925542697&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 200629', 35.1394374, 33.3640925, 'tanos-vasilios-nicosia'),
    ('Victoria Polyviou', 'Gynecology', 'Nicosia', 'https://maps.google.com/?cid=6367935396130026567&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 232911', 35.1670347999999, 33.3633395999999, 'victoria-polyviou-nicosia'),
    ('Anastasios Tranoulis', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=5129518262205977401&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 222666', 34.7892779, 32.4320816, 'anastasios-tranoulis-paphos'),
    ('Anastasis Panaretou', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=10275021330981310827&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 622655', 34.7871671, 32.4396027999999, 'anastasis-panaretou-paphos'),
    ('Andreas Matheou', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=1924018405602862864&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 055649', 34.7628002, 32.4384926, 'andreas-matheou-paphos'),
    ('Andreas Matheou', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=6392298380872882074&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 055649', 35.0355688, 32.4274775999999, 'andreas-matheou-paphos-2'),
    ('Charis Neocleous', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=3069177359483842533&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 221503', 34.773721, 32.4273976, 'charis-neocleous-paphos'),
    ('Charis Stylianou', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=8873686240792668889&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 433133', 34.797528, 32.4496623, 'charis-stylianou-paphos'),
    ('Christalla Prestou', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=7863570942676101982&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 699299', 34.76675, 32.4173222999999, 'christalla-prestou-paphos'),
    ('Christos Roukoudis', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=4785414247215767106&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 974310', 34.6966272999999, 33.0210119, 'christos-roukoudis-paphos'),
    ('Chrysostomou Spyridakis', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=11633630480425186952&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 556878', 34.787272, 32.4393366, 'chrysostomou-spyridakis-paphos'),
    ('Dimitra Georgiou', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=7243590536958734468&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 222666', 34.7892779, 32.4320816, 'dimitra-georgiou-paphos'),
    ('Dimitrios Grigoriou', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=12026681367028549259&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 376630', 35.1584912, 33.3676944, 'dimitrios-grigoriou-paphos'),
    ('Efterpi Tingi', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=9840940309816378325&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 247600', 34.6870466999999, 33.0279649, 'efterpi-tingi-paphos'),
    ('Evangelos Alexandrou', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=7571625523286461028&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 728484', 34.6899619, 33.0443625, 'evangelos-alexandrou-paphos'),
    ('Filippos Koundouros', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=1401169536685016679&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 371413', 34.6894349, 33.0456009, 'filippos-koundouros-paphos'),
    ('Fotis Vasiliou', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=6909418618849846512&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 996609', 34.7627795, 32.4384118, 'fotis-vasiliou-paphos'),
    ('Georges Parpas', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=8278003606786443780&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 949049', 34.7627468999999, 32.4384909, 'georges-parpas-paphos'),
    ('Georgios Mitas', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=9032918461013606685&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 952920', 34.6905286, 33.0349424, 'georgios-mitas-paphos'),
    ('Inesa Kesova', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=14624982534006923730&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 558562', 34.7860264, 32.4371541, 'inesa-kesova-paphos'),
    ('Irina Mzavanatze', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=13603098599413616950&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.778617, 32.4305900999999, 'irina-mzavanatze-paphos'),
    ('Irina Mzavanatze-Stampolidou', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=1693256817911258294&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 945509', 34.7789682, 32.4290035, 'irina-mzavanatze-stampolidou-paphos'),
    ('Konstantinos Mikellidis', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=7935373332342819205&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 417850', 34.7785897, 32.4292420999999, 'konstantinos-mikellidis-paphos'),
    ('Maria Paschalidou', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=8807052565136753016&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 222862', 34.7872456, 32.4395461999999, 'maria-paschalidou-paphos'),
    ('Natalia Sachnova', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=17899983086402545567&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.6901256999999, 33.0443901999999, 'natalia-sachnova-paphos'),
    ('Niki Agathokleous', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=16375484177458046117&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '70 007095', 34.6785575, 33.0391994999999, 'niki-agathokleous-paphos'),
    ('Panagiotis Antonakas', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=6983504343119294603&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 399994', 34.7865762, 32.4379999999999, 'panagiotis-antonakas-paphos'),
    ('Savvas Raftis', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=17365040997033574345&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 947948', 34.7870035, 32.4386558, 'savvas-raftis-paphos'),
    ('Stelios Kakoyiannis', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=11370747476221875957&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 675634', 34.7865762, 32.4379999999999, 'stelios-kakoyiannis-paphos'),
    ('Stelios Papasavvas', 'Gynecology', 'Paphos', 'https://maps.google.com/?cid=4031427444971756739&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 245688', 34.7739504, 32.4423613, 'stelios-papasavvas-paphos')
) as v(name, specialty, district, address_maps_link, phone, latitude, longitude, slug)
where not exists (
  select 1
  from public.directory_manual d
  where d.is_archived = false
    and (
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
    ))
);
