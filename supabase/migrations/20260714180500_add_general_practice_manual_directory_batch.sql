-- Append manual directory rows from spreadsheet (General Practitioners.xlsx).

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
    ('Eleni Naria Hadjicosta', 'General Practice', 'Larnaca', 'https://maps.google.com/?cid=12238877555371188550&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 246420', 34.9113863, 33.6190707999999, 'eleni-naria-hadjicosta'),
    ('Giorgos Christofi', 'General Practice', 'Larnaca', 'https://maps.google.com/?cid=12091662169360129075&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.8232912, 33.3887163, 'giorgos-christofi'),
    ('Iraklis Pantelidakis', 'General Practice', 'Larnaca', 'https://maps.google.com/?cid=687761826440271858&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '70 002270', 34.9298286, 33.6212419, 'iraklis-pantelidakis'),
    ('Menelaos Charalambous', 'General Practice', 'Larnaca', 'https://maps.google.com/?cid=18236106653323651435&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 653232', 34.9167307999999, 33.6339791, 'menelaos-charalambous'),
    ('Michalis Kittis', 'General Practice', 'Larnaca', 'https://maps.google.com/?cid=12425846549857428774&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.843517, 33.5739757, 'michalis-kittis'),
    ('Nikoletta Chatziapostolou', 'General Practice', 'Larnaca', 'https://maps.google.com/?cid=13233791839007648964&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 505620', 34.9080308, 33.6274915, 'nikoletta-chatziapostolou'),
    ('Panayiotis Constantinides', 'General Practice', 'Larnaca', 'https://maps.google.com/?cid=5381312988538892252&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '80 010250', 34.9703479, 33.6687648, 'panayiotis-constantinides'),
    ('Savvas Antoniades', 'General Practice', 'Larnaca', 'https://maps.google.com/?cid=1137374972049616566&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 356637', 34.9136424, 33.6341775, 'savvas-antoniades'),
    ('Vasiliki Karadima', 'General Practice', 'Larnaca', 'https://maps.google.com/?cid=14770289847771592429&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 670813', 35.0286313, 33.7685932, 'vasiliki-karadima'),
    ('Andreas Ioannou', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=5230454112212513834&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 715815', 34.6751777, 33.0126221999999, 'andreas-ioannou'),
    ('Angeliki Mina', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=5110116587899361733&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 000826', 34.6846385, 33.0282045, 'angeliki-mina'),
    ('Christina Stefanou', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=8551163836604904169&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 904738', 34.6721237, 33.0114399, 'christina-stefanou'),
    ('Demetris Nicolaides', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=17627808980484852728&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 580002', 34.6879233, 33.0510965, 'demetris-nicolaides'),
    ('Despo Protopapa', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=15552217255768255890&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 731488', 34.7016742, 33.0370269, 'despo-protopapa'),
    ('Elleny Panagioutou', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=4888783914224336786&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 779008', 34.6880066, 33.011669, 'elleny-panagioutou'),
    ('Fragkou Maria', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=13485747345925435424&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 222895', 34.6872073, 33.05593, 'fragkou-maria'),
    ('Gabriel Raad', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=5176385185911879419&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 312395', 34.6942133999999, 33.0811342999999, 'gabriel-raad'),
    ('Ioannis Kalos', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=3558654205974965203&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.6838964, 33.0330696, 'ioannis-kalos'),
    ('Maria Ioanna Anastassiadou', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=3836153004051619899&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 875587', 34.692867, 33.0671308999999, 'maria-ioanna-anastassiadou'),
    ('Maria Karampila', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=15188147439948709865&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '95 513470', 34.7052532, 33.0278316, 'maria-karampila'),
    ('Maria Lytras', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=8115831219544372617&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 550057', 34.7093837, 33.0568735, 'maria-lytras'),
    ('Marios Karaiskakis', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=3277043162721749785&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 870450', 34.6821161999999, 33.0402974, 'marios-karaiskakis'),
    ('Michael Hadjigavriel', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=15802834205642786862&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 222323', 34.6875232, 33.0249522, 'michael-hadjigavriel'),
    ('Michalis Chrysostomou', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=9959050204473530540&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 345550', 34.6825718, 33.0426748, 'michalis-chrysostomou'),
    ('Panagiotis Vagianas', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=13946925767859619719&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 574800', 34.7002886, 33.0763263, 'panagiotis-vagianas'),
    ('Savvas Ioannou', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=2257990181952748562&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 372003', 34.6824661, 33.0393937, 'savvas-ioannou'),
    ('Stella Charalampous', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=7513055311420881925&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 770370', 34.6807643, 33.0355039, 'stella-charalampous'),
    ('Tatiana Polycarpou', 'General Practice', 'Limassol', 'https://maps.google.com/?cid=2047369797872418396&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 747148', 34.6886443, 33.0303616, 'tatiana-polycarpou'),
    ('Antonis Stylianou', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=18125986038468868757&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 256055', 34.9441911, 33.5913301, 'antonis-stylianou'),
    ('Charalambos Nicolaou', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=5756487631091026845&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 444444', 35.1467202, 33.3531708999999, 'charalambos-nicolaou'),
    ('Christos Stephanou', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=11604487401344219073&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 992568', 35.1650875, 33.3301434, 'christos-stephanou'),
    ('Costas Christoforou', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=4686809881711059120&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 35.1595116, 33.3650650999999, 'costas-christoforou'),
    ('Dr Savvas K. Savva', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=2370890385009693705&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 442254', 35.1364352999999, 33.3572603, 'dr-savvas-k-savva'),
    ('Dr.akis Pouros', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=15924638096176715395&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 754830', 35.1619885, 33.3682401999999, 'drakis-pouros'),
    ('Illarion Ntovlatidis', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=15344678416429545104&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 494921', 35.1725225, 33.3310989, 'illarion-ntovlatidis'),
    ('Ioanna Stasopoulou', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=4718252171399212350&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 477147', 35.1442897999999, 33.3723356, 'ioanna-stasopoulou'),
    ('Ioannis Kronis', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=14220150791984015209&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 653700', 35.1636496, 33.3709373, 'ioannis-kronis'),
    ('Marconi Benoit', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=7580561383885546790&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 838481', 35.1555204, 33.3300862, 'marconi-benoit'),
    ('Marios Georgiou', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=11671370061957476237&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 635135', 35.1618729, 33.3649185, 'marios-georgiou'),
    ('Michail Papoulas', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=7016535945250466217&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 282009', 35.1394673, 33.3644599, 'michail-papoulas'),
    ('Natasa Kyriacou Christofides', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=11875535539405821980&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 551433', 35.163123, 33.3648907, 'natasa-kyriacou-christofides'),
    ('Panayiota Charalambous', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=3301835062030605650&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 174567', 34.9166358, 33.6261176, 'panayiota-charalambous'),
    ('Stephanos Eliades', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=3827547925835916528&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 896923', 35.1391507999999, 33.3650995, 'stephanos-eliades'),
    ('Stylianos Kazakos', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=18153961820097902531&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 665441', 34.9286575, 33.6163583, 'stylianos-kazakos'),
    ('Victoria Polyviou', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=6367935396130026567&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 232911', 35.1670347999999, 33.3633395999999, 'victoria-polyviou'),
    ('Zanna Karagkezidou', 'General Practice', 'Nicosia', 'https://maps.google.com/?cid=14919176508445021777&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 333232', 35.1153104, 33.3767352, 'zanna-karagkezidou'),
    ('Andreas Petrides', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=3170813926146618812&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 934165', 34.7818916999999, 32.4278342, 'andreas-petrides'),
    ('Antonio Stavrou', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=439872556430941127&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 933100', 34.6732243999999, 32.9049872, 'antonio-stavrou'),
    ('Athanasios Athanasiou', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=15239129608358415935&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 323233', 35.0362996, 32.4293135, 'athanasios-athanasiou'),
    ('Avraam Tsavdaroglou', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=7164282650628867779&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 848484', 34.7627872, 32.4384077, 'avraam-tsavdaroglou'),
    ('Charis Stylianou', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=8873686240792668889&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 433133', 34.797528, 32.4496623, 'charis-stylianou'),
    ('Christalla Prestou', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=7863570942676101982&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 699299', 34.76675, 32.4173222999999, 'christalla-prestou'),
    ('Chryso Chrysanthou', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=15609446692949676471&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 220956', 34.7860264, 32.4371541, 'chryso-chrysanthou'),
    ('Chryso Chrysanthou', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=13980777409998596693&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 848000', 34.7864954, 32.4379795, 'chryso-chrysanthou-paphos'),
    ('Dora Karaphillidou', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=14853542847121688978&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 221111', 34.7764607, 32.4425658, 'dora-karaphillidou'),
    ('Dr Marina Liasidou', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=6669399596904081940&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 848199', 34.7862686, 32.4370350999999, 'dr-marina-liasidou'),
    ('Fotis Vasiliou', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=6909418618849846512&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 996609', 34.7627795, 32.4384118, 'fotis-vasiliou'),
    ('Irina Mzavanatze-Stampolidou', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=1693256817911258294&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 945509', 34.7789682, 32.4290035, 'irina-mzavanatze-stampolidou'),
    ('Kakoyiannis Stelios', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=11370747476221875957&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 675634', 34.7865762, 32.4379999999999, 'kakoyiannis-stelios'),
    ('Kristia Chrysostomou', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=18190752794372701904&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 220142', 34.7887871, 32.4329063, 'kristia-chrysostomou'),
    ('Maria Iasonos', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=9077461473049676417&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 065845', 34.786127, 32.4354655, 'maria-iasonos'),
    ('Panagiotis Antonakas', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=6983504343119294603&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 399994', 34.7865762, 32.4379999999999, 'panagiotis-antonakas'),
    ('Stephania Christou', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=11133161616177323129&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 953000', 34.7626541, 32.4177361, 'stephania-christou'),
    ('Theodora Bartzou', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=12214821525548603287&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 442323', 34.8825895999999, 32.3804674, 'theodora-bartzou'),
    ('Varvara Poursanidou', 'General Practice', 'Paphos', 'https://maps.google.com/?cid=3948243470970417262&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 572350', 34.7792650999999, 32.431607, 'varvara-poursanidou')
) as v(name, specialty, district, address_maps_link, phone, latitude, longitude, slug)
where not exists (
  select 1
  from public.directory_manual d
  where d.is_archived = false
    and (
      lower(d.name) = lower(v.name)
      or d.address_maps_link = v.address_maps_link
    )
);
