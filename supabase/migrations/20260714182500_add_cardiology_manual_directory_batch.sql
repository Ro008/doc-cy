-- Append manual directory rows from spreadsheet (Cardiologist.xlsx).

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
    ('Christos D. Kallianos', 'Cardiology', 'Larnaca', 'https://maps.google.com/?cid=9045365807594977572&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 827727', 34.9167403, 33.6260744, 'christos-d-kallianos'),
    ('Christos Spiliotopoulos', 'Cardiology', 'Larnaca', 'https://maps.google.com/?cid=382383732733287731&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 595395', 35.060815, 33.9642093, 'christos-spiliotopoulos'),
    ('Constantinos Meggesides', 'Cardiology', 'Larnaca', 'https://maps.google.com/?cid=1548990195716663319&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 010615', 35.1151974, 33.3767916, 'constantinos-meggesides'),
    ('Georgios Miliotis', 'Cardiology', 'Larnaca', 'https://maps.google.com/?cid=14493937119067813682&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.9185867, 33.6132475, 'georgios-miliotis'),
    ('Kyriaki Sabotinova', 'Cardiology', 'Larnaca', 'https://maps.google.com/?cid=9371544533040915887&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 667626', 34.9300263999999, 33.5995062, 'kyriaki-sabotinova'),
    ('Sotiris Tsangaris', 'Cardiology', 'Larnaca', 'https://maps.google.com/?cid=14527712781705831655&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 990969 ext. 24840840', 34.9254347, 33.6166124999999, 'sotiris-tsangaris'),
    ('Stephanis Gianni', 'Cardiology', 'Larnaca', 'https://maps.google.com/?cid=5551483695422833585&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 930360', 35.0381019999999, 33.9813129, 'stephanis-gianni'),
    ('Achilleas Toursidis', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=17991096678437320432&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 260700', 34.7062503, 33.0255805, 'achilleas-toursidis'),
    ('Andreas Selias', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=6112238970409864057&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 661199', 34.6975598, 33.0299359, 'andreas-selias'),
    ('Antoniades Andreas', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=13426694365026580582&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 347090', 34.690253, 33.0241764999999, 'antoniades-andreas'),
    ('Antreas Ioannides', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=9040360504994510307&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.6901560999999, 33.024217, 'antreas-ioannides'),
    ('Constantinos Kyriacou', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=12588807381607195281&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 108850', 34.6822795, 33.0405833, 'constantinos-kyriacou'),
    ('Demetrios Konstantinidis', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=16793020635522697506&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 755303', 34.700037, 33.0761049, 'demetrios-konstantinidis'),
    ('Demetris Nicolaides', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=17627808980484852728&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 580002', 34.6879233, 33.0510965, 'demetris-nicolaides'),
    ('Georgios Christodoulidis', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=42784868560384765&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 350250', 34.681045, 33.04125, 'georgios-christodoulidis'),
    ('Giorgos Panayi', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=10916308173160333879&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 208293', 34.7297875, 33.0604334, 'giorgos-panayi'),
    ('Irine Mavrikidou', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=13747879013002421327&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 363554', 34.7002990999999, 33.0763294, 'irine-mavrikidou'),
    ('Iryna Vasileiadou', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=18328901788812499227&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 352006', 34.6848339999999, 33.0438819999999, 'iryna-vasileiadou'),
    ('Lakis Drousiotis', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=12479999548917526987&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 726464', 34.7060424999999, 33.0406201, 'lakis-drousiotis'),
    ('Marios Lemoniatis', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=1190692890034689419&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 252560', 34.6823822, 33.0175051999999, 'marios-lemoniatis'),
    ('Michalis Lanitis', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=10936924530540472942&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 347316', 34.6833761, 33.0401564, 'michalis-lanitis'),
    ('Nicoletta Orphanou', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=14099860735441031585&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 444444', 35.1467202, 33.3531708999999, 'nicoletta-orphanou'),
    ('Panagiotis Plangesis', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=8393131571373156209&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 726464', 34.7061117, 33.0405924999999, 'panagiotis-plangesis'),
    ('Panayiotis Demostenous', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=12190212012348826933&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 252540', 34.68598, 33.0228517, 'panayiotis-demostenous'),
    ('Panayiotis Kerimis', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=17653822834551012864&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 351100', 34.6835203, 33.0380435, 'panayiotis-kerimis'),
    ('Pantelis Georgiou', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=5975730253474359992&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 722121', 34.7027638, 33.0482165999999, 'pantelis-georgiou'),
    ('Photos Ioannides', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=2114213778255803030&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 355999', 34.6841773, 33.040833, 'photos-ioannides'),
    ('Savvas Ioannou', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=2257990181952748562&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 372003', 34.6824661, 33.0393937, 'savvas-ioannou'),
    ('Takis Karoulas', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=3198530677392626849&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 880048', 34.9281478, 33.6330617, 'takis-karoulas'),
    ('Tereza Antoniade', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=857129370185286255&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 334114', 34.6913416999999, 33.029583, 'tereza-antoniade'),
    ('Zisis Dimitriadis', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=10954018393477100526&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 200107', 34.705113, 33.0277537, 'zisis-dimitriadis'),
    ('Zoe Nicolaou', 'Cardiology', 'Limassol', 'https://maps.google.com/?cid=17430131263408955783&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 761010', 34.6884058, 33.0441274, 'zoe-nicolaou'),
    ('Angelos Tyrlis', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=10965624635281381222&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 782134', 35.1462937999999, 33.3466212, 'angelos-tyrlis'),
    ('Antonis Ioannou', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=18370485595521250424&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 255210', 35.164958, 33.3310802999999, 'antonis-ioannou'),
    ('Christos Christopoulos', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=14013906498476046331&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 006911 ext. 22272282', 35.1555204, 33.3300862, 'christos-christopoulos'),
    ('Chrysostomi Papachrysostomou', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=738212877538382131&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 622200', 35.161595, 33.3319786, 'chrysostomi-papachrysostomou'),
    ('Eleni Cleanthous', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=6995346117310011969&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 660006', 35.1497723999999, 33.3484884, 'eleni-cleanthous'),
    ('Evagoras Economides', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=16176364011729366519&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 712056', 35.1391872999999, 33.3650631, 'evagoras-economides'),
    ('Fay Apostolou', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=3800117045794009946&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 522800', 35.1419105999999, 33.3596354, 'fay-apostolou'),
    ('Kyriakos Yiangou', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=15393552548968840342&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 515111', 35.1410970999999, 33.3396012, 'kyriakos-yiangou'),
    ('Lambros Kypri', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=5798659391508802549&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 388807', 35.1413825, 33.3706467999999, 'lambros-kypri'),
    ('Loizos Antoniades', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=16851209526791790702&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 608403', 35.1624213, 33.3675703, 'loizos-antoniades'),
    ('Maria Maimari', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=15834241824316211323&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 410120', 35.1658624, 33.3495554, 'maria-maimari'),
    ('Petros M Petrou', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=16260786503106556969&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 272282', 35.1235463999999, 33.320991, 'petros-m-petrou'),
    ('Pieros Georgiou', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=8817972998232984226&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 425090', 35.1541086, 33.3673577, 'pieros-georgiou'),
    ('Vassilis Barberis', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=14972420677763570580&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 720004', 35.1673417, 33.3633978999999, 'vassilis-barberis'),
    ('Vassilis Economides', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=2024676107664032455&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 455588', 35.1609233, 33.3567815, 'vassilis-economides'),
    ('Vicki Zeniou', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=6033461122971931281&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 819278', 35.1690472999999, 33.3444188, 'vicki-zeniou'),
    ('Yiannis Panayiotides', 'Cardiology', 'Nicosia', 'https://maps.google.com/?cid=13260219353405461870&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 316525', 35.1656978, 33.3668784, 'yiannis-panayiotides'),
    ('Andreas Petrides', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=3170813926146618812&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 934165', 34.7818916999999, 32.4278342, 'andreas-petrides'),
    ('Aspasia Thanasia', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=8034015996232179709&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 323216', 34.7406232999999, 33.0069073999999, 'aspasia-thanasia'),
    ('Charis Mamilou', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=2685332940411110350&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 334000', 34.6818279999999, 33.041608, 'charis-mamilou'),
    ('Christodoulou Chrysovalantis', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=12374766219589320024&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 732732', 34.7811596999999, 32.4364314, 'christodoulou-chrysovalantis'),
    ('Christos Angelidis', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=1404704519548735343&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 780007', 34.7099435, 33.0763829, 'christos-angelidis'),
    ('Chryso Lambrianidi', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=677280914753085302&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 322202', 34.7131024, 33.0651457999999, 'chryso-lambrianidi'),
    ('Constantinides Thrasos', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=6250396826932436791&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 730462', 35.1526573999999, 33.3642627, 'constantinides-thrasos'),
    ('Constantinos Ergatoudes', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=10183148940921776564&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 588845', 34.6831897, 33.0375189999999, 'constantinos-ergatoudes'),
    ('Constantinos Makrides', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=15652899663450493825&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 101102', 34.6808616, 33.0130283999999, 'constantinos-makrides'),
    ('Constantinos Neophytou', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=17169545721285043674&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 729534', 34.6934021, 33.0516363, 'constantinos-neophytou'),
    ('Costas Papadopoulos', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=6807476521644262520&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 675455', 34.787272, 32.4393366, 'costas-papadopoulos'),
    ('Dorel P.dimcea', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=9066940651710363194&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 375406', 34.7555405999999, 32.4199498, 'dorel-pdimcea'),
    ('Evros Loizides', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=4002181696287538346&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.7705429999999, 32.429764, 'evros-loizides'),
    ('Gavriel Angelos', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=5350952078054637987&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 253234', 34.6995249, 33.0542407999999, 'gavriel-angelos'),
    ('Giannakopoulos Vasileios', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=14824645459305152433&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 527603', 34.7766844, 32.4426448, 'giannakopoulos-vasileios'),
    ('Ioannis Michaloliakos', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=11284056912535151749&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 109077', 34.6850231, 32.9636046, 'ioannis-michaloliakos'),
    ('Kyriakos Kyriakou', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=18322731205665824164&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 943326', 34.7861506, 32.4354119, 'kyriakos-kyriakou'),
    ('Marios Theodotou', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=4202633090100515955&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 356856', 34.682047, 33.032123, 'marios-theodotou'),
    ('Michaelides Andreas', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=15947719956262169140&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 254055', 34.9172346, 33.6100878999999, 'michaelides-andreas'),
    ('Nicodemos Kosti', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=9123611470065114626&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 998979', 34.7888626999999, 32.4328985, 'nicodemos-kosti'),
    ('Nikoletta Evripidou', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=14364672156666527117&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 920331', 34.787272, 32.4393366, 'nikoletta-evripidou'),
    ('Nikos Karpettas', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=14779284702938182534&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 345454', 34.69838, 33.0376677, 'nikos-karpettas'),
    ('Osman Beton', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=10332192624722023355&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '(0392) 224 00 40', 35.2038994, 33.3188232, 'osman-beton'),
    ('Panagiotis Tavelis', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=8857117518739614358&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 320010', 34.6898457, 32.9570615999999, 'panagiotis-tavelis'),
    ('Petros Mavrommatis', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=9099665183415797394&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 939500', 34.7907066, 32.4380595, 'petros-mavrommatis'),
    ('Savvas Hadjiphilippou', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=13339804780416782306&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 884852', 34.6819665, 33.0409006, 'savvas-hadjiphilippou'),
    ('Savvas Hadjiphilippou', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=7021665242652606382&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 368900', 34.9913823, 33.778205, 'savvas-hadjiphilippou-paphos'),
    ('Sotiris Attipas', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=8114811860522507706&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 333021', 34.7052236, 33.0305846, 'sotiris-attipas'),
    ('Stelios Papasavvas', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=4031427444971756739&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 245688', 34.7739504, 32.4423613, 'stelios-papasavvas'),
    ('Zacharias Kounnis', 'Cardiology', 'Paphos', 'https://maps.google.com/?cid=16378093671517241887&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 389696', 34.6981898, 33.0212235, 'zacharias-kounnis')
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
