-- Append manual directory rows from spreadsheet (Pediatrician.xlsx).

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
    ('Anastasia Symeou', 'Pediatrics', 'Larnaca', 'https://maps.google.com/?cid=13869342026389866321&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 515130', 35.0163834999999, 33.4035499, 'anastasia-symeou'),
    ('Chrystalla Keliri', 'Pediatrics', 'Larnaca', 'https://maps.google.com/?cid=5732524086533550487&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.938367, 33.5915327999999, 'chrystalla-keliri'),
    ('Georgios Chatziantonis', 'Pediatrics', 'Larnaca', 'https://maps.google.com/?cid=9012683890283605039&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.928585, 33.6153039, 'georgios-chatziantonis'),
    ('Georgios Kassis', 'Pediatrics', 'Larnaca', 'https://maps.google.com/?cid=15404550220696433249&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 663325', 34.9271344, 33.6155657, 'georgios-kassis'),
    ('Katerina Pavlidou Hadjikyriacou', 'Pediatrics', 'Larnaca', 'https://maps.google.com/?cid=3386073236815125852&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 648633', 34.9157522, 33.610039, 'katerina-pavlidou-hadjikyriacou'),
    ('Michalis Papagregoriou', 'Pediatrics', 'Larnaca', 'https://maps.google.com/?cid=18382303994934021298&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 688786', 34.9470794, 33.591416100000004, 'michalis-papagregoriou'),
    ('Christakis Theocharous', 'Pediatrics', 'Limassol', 'https://maps.google.com/?cid=15937942025968014505&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 449977', 34.6865024, 33.0480764, 'christakis-theocharous'),
    ('Doria Stephanou', 'Pediatrics', 'Limassol', 'https://maps.google.com/?cid=16876922379631365910&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 525716', 34.6741542, 33.0267558, 'doria-stephanou'),
    ('Elli Modestou', 'Pediatrics', 'Limassol', 'https://maps.google.com/?cid=9314192915878789918&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '94 041311', 34.6762762, 33.0252581999999, 'elli-modestou'),
    ('Georgia Koukli', 'Pediatrics', 'Limassol', 'https://maps.google.com/?cid=3328327203915669812&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 746222', 34.6824887, 33.0388146999999, 'georgia-koukli'),
    ('Heodosia Thoma', 'Pediatrics', 'Limassol', 'https://maps.google.com/?cid=327404150556857295&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 350250', 34.681045, 33.04125, 'heodosia-thoma'),
    ('Katerina Sarri', 'Pediatrics', 'Limassol', 'https://maps.google.com/?cid=1692258598946359047&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 132667', 34.8543482, 33.583069, 'katerina-sarri'),
    ('Mary Radu', 'Pediatrics', 'Limassol', 'https://maps.google.com/?cid=127635454908314606&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.6934526, 33.0444955, 'mary-radu'),
    ('Michalis Lioubas', 'Pediatrics', 'Limassol', 'https://maps.google.com/?cid=6434668328222426357&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 515280', 35.0247041, 33.4200152, 'michalis-lioubas'),
    ('Nicos Toumbas', 'Pediatrics', 'Limassol', 'https://maps.google.com/?cid=3451334454607905447&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 818168', 34.6847075, 33.0307921, 'nicos-toumbas'),
    ('Nikolaos Christoforou', 'Pediatrics', 'Limassol', 'https://maps.google.com/?cid=13911392827061019746&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 367937', 34.6828936, 33.0365854, 'nikolaos-christoforou'),
    ('Nikolas Paschalides', 'Pediatrics', 'Limassol', 'https://maps.google.com/?cid=2625425534268783016&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 749440', 34.6905512, 33.0479672999999, 'nikolas-paschalides'),
    ('Rafaela Iereidi', 'Pediatrics', 'Limassol', 'https://maps.google.com/?cid=11926337587978564803&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 557383', 34.6894469, 33.0243968, 'rafaela-iereidi'),
    ('Toula Siamisi Andreou', 'Pediatrics', 'Limassol', 'https://maps.google.com/?cid=2362576877298439500&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 339997', 34.7059782, 33.0184607, 'toula-siamisi-andreou'),
    ('Vasilia Souleimanova', 'Pediatrics', 'Limassol', 'https://maps.google.com/?cid=1047484499258993072&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 431952', 34.6901212, 33.0444272999999, 'vasilia-souleimanova'),
    ('Yaroslava Spiridonova', 'Pediatrics', 'Limassol', 'https://maps.google.com/?cid=3000604337339449607&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 565456', 34.7143466, 33.1650054, 'yaroslava-spiridonova'),
    ('Alkis Papadouris', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=10349905269002566173&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 317700', 35.1672069, 33.3447366, 'alkis-papadouris'),
    ('Andreas Kouzalis', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=338533403696656085&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 760800', 35.1591374, 33.3609383, 'andreas-kouzalis'),
    ('Andreas Stavrides', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=5369374141601211261&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 772828', 35.1737105, 33.3373895, 'andreas-stavrides'),
    ('Anna Hadjilaou Radevic', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=18287628060114338823&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 582999', 35.1544713, 33.1980151, 'anna-hadjilaou-radevic'),
    ('Anna Mavronikola', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=18128598439698296905&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 336565', 35.1580401999999, 33.345076, 'anna-mavronikola'),
    ('Charalambos Dionysiou', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=3120596348395081349&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 464174', 35.1717973999999, 33.330194, 'charalambos-dionysiou'),
    ('Christina Avraam', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=2438177223468838147&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '94 058272', 35.1507047, 33.3048056999999, 'christina-avraam'),
    ('Christina Karaoli', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=2930348491695385126&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 421604', 35.1438591, 33.3339524999999, 'christina-karaoli'),
    ('Christos Kyprianou', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=6052555962615438097&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 693569', 35.1570876, 33.3847409, 'christos-kyprianou'),
    ('Demetra Hadjiyiannis', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=17702167465445170847&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 660011', 34.9186895, 33.6133946, 'demetra-hadjiyiannis'),
    ('Eliana Athinodorou', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=866303718084351713&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 35.1640211, 33.346494, 'eliana-athinodorou'),
    ('Iliana Aristidou', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=6787361099955344037&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 380370', 35.15437, 33.3442747, 'iliana-aristidou'),
    ('Ioanna Stylianou', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=386941257314740388&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 441300', 35.1673526999999, 33.3676366, 'ioanna-stylianou'),
    ('Ioannis Hadjiminas', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=17112137367032898191&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 781550', 35.1685466, 33.3474007999999, 'ioannis-hadjiminas'),
    ('Ioannis Makariou', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=1271985052261890094&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 000450', 35.1561659, 33.3718171999999, 'ioannis-makariou'),
    ('Irene Paphiti Demetriou', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=8574604752200262097&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 591791', 35.1650875, 33.3301434, 'irene-paphiti-demetriou'),
    ('Kyriakos Hatzilambris', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=1770644822412073905&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 513400', 35.1545506, 33.3606392, 'kyriakos-hatzilambris'),
    ('Lga Rubashkina', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=1979716239432446736&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 753363', 35.1674412, 33.3717028, 'lga-rubashkina'),
    ('Makis Solomou', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=3453979563301637080&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 510120', 35.1357868, 33.3473492, 'makis-solomou'),
    ('Maria Mouyiari Kyriakidi', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=10033968708135591488&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 631416', 35.0595062999999, 33.5397254999999, 'maria-mouyiari-kyriakidi'),
    ('Maria Neophytou', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=3170531452973392936&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 329292', 35.1499125, 33.3601169999999, 'maria-neophytou'),
    ('Marina Psyllaki Pravodelov', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=719374808749264437&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 775810', 35.1676414, 33.3419105, 'marina-psyllaki-pravodelov'),
    ('Marios Soumakis', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=15225824451012295831&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 626462', 35.0642278, 33.5351543999999, 'marios-soumakis'),
    ('Michalis Anastasiadis', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=17021368978962480711&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 477000', 35.1674669, 33.3306514, 'michalis-anastasiadis'),
    ('Paris Iacovides', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=14283324532851626140&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 755155', 35.1641094, 33.3465024, 'paris-iacovides'),
    ('Tasos Tzirtzipis', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=4507394326908066481&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 311495', 35.1543376, 33.344253, 'tasos-tzirtzipis'),
    ('Yianna Pieridou Zesiadou', 'Pediatrics', 'Nicosia', 'https://maps.google.com/?cid=9003142871178177284&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 680902', 35.1672069, 33.3447366, 'yianna-pieridou-zesiadou'),
    ('Anastasiou Tasos', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=2819806652422769378&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 528724', 34.9054281999999, 33.5894058999999, 'anastasiou-tasos'),
    ('Andreas Eleftheriadis', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=13980777409998596693&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 848000', 34.7864954, 32.4379795, 'andreas-eleftheriadis'),
    ('Andreas Pashias', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=5620014921554132090&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 586144', 34.6919214, 33.0622391, 'andreas-pashias'),
    ('Andreas Petrides', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=3170813926146618812&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 934165', 34.7818916999999, 32.4278342, 'andreas-petrides'),
    ('Anthoula Loizidou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=12694334833321270432&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 936655', 34.7854540999999, 32.4245267, 'anthoula-loizidou'),
    ('Artemis Polycarpou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=3167050408267917421&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 803110', 34.7883890999999, 32.4446145, 'artemis-polycarpou'),
    ('Athanasios Athanasios', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=4632774104564468818&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 323233', 35.036279, 32.4292845999999, 'athanasios-athanasios'),
    ('Chara Papageorgiou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=3632479465898638101&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 014085', 34.7018777, 32.9906795, 'chara-papageorgiou'),
    ('Charis Neocleous', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=3069177359483842533&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 221503', 34.773721, 32.4273976, 'charis-neocleous'),
    ('Charis Stylianou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=8873686240792668889&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 433133', 34.797528, 32.4496623, 'charis-stylianou'),
    ('Christos Christofi', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=9221184012839166718&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 385858', 34.6922464999999, 33.0307813, 'christos-christofi'),
    ('Christos Demetriou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=6654905266386077622&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 937727', 34.7808049, 32.4317564, 'christos-demetriou'),
    ('Despo Eleftheriou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=2515769284534254947&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 383822', 34.6862232, 33.0370169, 'despo-eleftheriou'),
    ('Elpiniki Rotsa Khabiz', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=2205909859127280829&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 420630', 34.6669834, 33.0217796999999, 'elpiniki-rotsa-khabiz'),
    ('Fotini Hadjidemetriou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=5911975674604713798&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.6584767, 32.9981749999999, 'fotini-hadjidemetriou'),
    ('George Loizides', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=11890779284460379967&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 655533', 34.7792497, 32.4302932, 'george-loizides'),
    ('George Marcou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=12011059572733898796&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 335833', 34.6834548, 33.0293849, 'george-marcou'),
    ('Georgia Marangou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=12814360756576262627&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 490962', 34.789289, 32.4321206, 'georgia-marangou'),
    ('Giannelos Michail', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=7638466772827740717&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 668656', 34.8752871, 32.3798108, 'giannelos-michail'),
    ('Giannis Chatzimichail', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=5461004835760835239&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 522152', 34.6816169999999, 33.0117294, 'giannis-chatzimichail'),
    ('Giorgos Naifa', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=12485610257755140505&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 550090', 34.7626376, 32.4177471, 'giorgos-naifa'),
    ('Iliada Evripidou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=13980777409998596693&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 848000', 34.7864954, 32.4379795, 'iliada-evripidou'),
    ('Ioannis Soultanidis', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=16353115105013525658&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 045900', 34.6973478, 33.0488512, 'ioannis-soultanidis'),
    ('Kleopatra Savva', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=12994081216512960118&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 828141', 34.6965741, 33.0471627999999, 'kleopatra-savva'),
    ('Kyriaki Andreou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=6013580577897091040&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 934022', 34.6825068, 33.0388242, 'kyriaki-andreou'),
    ('Kyriaki Evgeniou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=10999687692262519674&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 251009', 35.1031684, 33.3794776, 'kyriaki-evgeniou'),
    ('Maria Cleanthous', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=4021344120193864159&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 974776', 35.0146418, 33.3953834, 'maria-cleanthous'),
    ('Maria Maragkou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=13980777409998596693&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 848000', 34.7864954, 32.4379795, 'maria-maragkou'),
    ('Maria Paschalidou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=8807052565136753016&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 222862', 34.7872456, 32.4395461999999, 'maria-paschalidou'),
    ('Maria Pashalidou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=13980777409998596693&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 848000', 34.7864954, 32.4379795, 'maria-pashalidou'),
    ('Maria Strouthou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=3270598769206331440&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.6894577, 33.0243938, 'maria-strouthou'),
    ('Maria Tsappi', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=13107069168705193870&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 251556', 34.9081791, 33.5989226, 'maria-tsappi'),
    ('Marios Neocleous', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=18351466003350949395&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 343943', 34.6902738, 33.0504433, 'marios-neocleous'),
    ('Marios Thrasivoulides', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=14853542847121688978&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 221111', 34.7764607, 32.4425658, 'marios-thrasivoulides'),
    ('Michaela Koundourou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=10014143245028508713&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 722444', 34.798152, 32.4484488999999, 'michaela-koundourou'),
    ('Nicolas Kalogirou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=8286185387023034526&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '70 006353', 34.6823822, 33.0175051999999, 'nicolas-kalogirou'),
    ('Nikos Konnaris', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=13980777409998596693&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 848000', 34.7864954, 32.4379795, 'nikos-konnaris'),
    ('Nitsa Diakou Kyriacou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=10059781694889201465&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 343213', 34.6818143, 33.0415043, 'nitsa-diakou-kyriacou'),
    ('Panagiotis Pattas', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=6303733156687125614&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 716260', 34.6645032, 33.0035759, 'panagiotis-pattas'),
    ('Petros Troulakis', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=15194446450980500043&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 870710', 34.7055755, 33.0330338, 'petros-troulakis'),
    ('Petrou Lavrentis Georgios', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=4768449134402236657&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 322500', 35.0355572, 32.4272096, 'petrou-lavrentis-georgios'),
    ('Renos Petrou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=13811484336318244514&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 729917', 34.7032932, 33.0383072, 'renos-petrou'),
    ('Savvas Savoullas', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=12873117937400894815&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 755633', 34.7007213, 33.0466364, 'savvas-savoullas'),
    ('Semeli Tsikkini', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=4000299108012234785&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 323235', 34.674194, 33.0245978999999, 'semeli-tsikkini'),
    ('Symeon Kitiris', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=6764699950829920942&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 870710', 34.7056458, 33.0329895, 'symeon-kitiris'),
    ('Theodoros Andreou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=17947266774436700121&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 943446', 34.7840767, 32.4227243, 'theodoros-andreou'),
    ('Theodoros Athinodorou', 'Pediatrics', 'Paphos', 'https://maps.google.com/?cid=13980777409998596693&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 848000', 34.7864954, 32.4379795, 'theodoros-athinodorou')
) as v(name, specialty, district, address_maps_link, phone, latitude, longitude, slug)
where not exists (
  select 1
  from public.directory_manual d
  where d.is_archived = false
    and (
      lower(d.name) = lower(v.name)
      
    )
);
