-- Append manual directory rows from spreadsheet (new_toUPLOAD_psychiatrist_CLEANED.xlsx).

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
    ('Andreas Kitsios', 'Psychiatry', 'Larnaca', 'https://maps.google.com/?cid=3161529921356442657&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '95 951875', 34.9302649, 33.6011246, 'andreas-kitsios-larnaca'),
    ('Christina Archontous', 'Psychiatry', 'Larnaca', 'https://maps.google.com/?cid=18318069979135788902&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 259088', 35.0426949, 33.9935725, 'christina-archontous-larnaca'),
    ('Dora Costa', 'Psychiatry', 'Larnaca', 'https://maps.google.com/?cid=617575026805358957&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 635699', 35.0501949999999, 33.9855938, 'dora-costa-larnaca'),
    ('Elena Chatzithoma', 'Psychiatry', 'Larnaca', 'https://maps.google.com/?cid=7555181481148517222&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 447909', 34.9317196, 33.619938, 'elena-chatzithoma-larnaca'),
    ('Eleni Michael', 'Psychiatry', 'Larnaca', 'https://maps.google.com/?cid=9735435441320351414&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '94 603531', 34.9360567999999, 33.5904996, 'eleni-michael-larnaca'),
    ('Floris Stylios', 'Psychiatry', 'Larnaca', 'https://maps.google.com/?cid=7523240361632775254&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.917187, 33.6102412, 'floris-stylios-larnaca'),
    ('Froso Souroulla', 'Psychiatry', 'Larnaca', 'https://maps.google.com/?cid=12377205926082835489&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 746101', 34.9044449999999, 33.6305074, 'froso-souroulla-larnaca'),
    ('Maria Thoma', 'Psychiatry', 'Larnaca', 'https://maps.google.com/?cid=14308056130191334473&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 961030', 34.9462180999999, 33.5946857, 'maria-thoma-larnaca'),
    ('Stella Konia', 'Psychiatry', 'Larnaca', 'https://maps.google.com/?cid=12924978338006146895&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 173613', 34.9198042, 33.6164012, 'stella-konia-larnaca'),
    ('Alexis Antoniou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=2016163902688158386&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 759027', 34.6921363, 33.015751, 'alexis-antoniou-limassol'),
    ('Anastasia Burelomova', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=13723711645809280444&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 056325', 34.6929173, 33.0412852, 'anastasia-burelomova-limassol'),
    ('Andreas Chatziantonas', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=6834240135654695460&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 352800', 34.681782, 33.0351474, 'andreas-chatziantonas-limassol'),
    ('Andreas Ioannides', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=15183108698361230158&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 335002', 34.6823319999999, 33.040506, 'andreas-ioannides-limassol'),
    ('Andria Sofokleous', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=5014884537268348432&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 909047', 34.690146, 33.05916, 'andria-sofokleous-limassol'),
    ('Antonios Papaneofytou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=12467540119289776298&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 366719', 34.9168936, 33.6270376, 'antonios-papaneofytou-limassol'),
    ('Argyris Argyriou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=1239376146299241799&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 746222', 34.6825289999999, 33.0387459999999, 'argyris-argyriou-limassol'),
    ('Charis Stavrou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=8204663107585633256&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 244233', 34.6814797, 33.0195546, 'charis-stavrou-limassol'),
    ('Costas Adamides', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=6778963563329388170&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '94 048080', 35.1715252, 33.3506382, 'costas-adamides-limassol'),
    ('Elias Nikolaides', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=5873690283589068643&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 388989', 34.6810970999999, 33.0350579, 'elias-nikolaides-limassol'),
    ('Giannis Ioannou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=12691109154720225607&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 717172', 34.681045, 33.04125, 'giannis-ioannou-limassol'),
    ('Giantia Galatopoulou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=4425182263176979226&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 009377', 34.6861521999999, 33.0442979, 'giantia-galatopoulou-limassol'),
    ('Iro Michael', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=10447382905083916242&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 462251', 34.6858745, 33.0546448, 'iro-michael-limassol'),
    ('Konstantina Evelthontos', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=955840439379735373&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 480009', 34.6984177, 32.9591864, 'konstantina-evelthontos-limassol'),
    ('Konstantinos Efthymiou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=9802953618507285506&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 427474', 35.1441272, 33.3445983, 'konstantinos-efthymiou-limassol'),
    ('Konstantinos Zampas', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=2714161537514890550&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 737269', 35.1520426999999, 33.3708099, 'konstantinos-zampas-limassol'),
    ('Lambros Polyviou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=2042089458705907511&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 098700', 35.1662582, 33.3689752, 'lambros-polyviou-limassol'),
    ('Lawrence Kalogreades', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=14660912418410843291&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 338248', 34.6817468, 33.028731, 'lawrence-kalogreades-limassol'),
    ('Lolita Papacosta', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=12930920235892551543&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 503393', 34.6880623, 33.0623933, 'lolita-papacosta-limassol'),
    ('Lycourgos Theodorides', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=17767968355843137969&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 074800', 34.6820229, 33.0321728, 'lycourgos-theodorides-limassol'),
    ('Maria Gkliaou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=16934182575150122087&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 374040', 34.6828132, 33.0411384999999, 'maria-gkliaou-limassol'),
    ('Maria Theofilidou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=468979643413817526&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 660333', 34.9380901, 33.5916476999999, 'maria-theofilidou-limassol'),
    ('Marilyn George', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=1071426579955173342&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 762345', 34.6862896999999, 33.0338732999999, 'marilyn-george-limassol'),
    ('Marina Antoniou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=11230745218626226448&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.6858074999999, 33.0459844999999, 'marina-antoniou-limassol'),
    ('Marina Antoniou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=2261423325840468503&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 461926', 35.1031684, 33.3794776, 'marina-antoniou-limassol-2'),
    ('Panayiotis Demostenous', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=12190212012348826933&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 252540', 34.68598, 33.0228517, 'panayiotis-demostenous-limassol'),
    ('Simos Kyriakidis', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=14734912579059056775&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 673056', 35.1656389, 33.3593045, 'simos-kyriakidis-limassol'),
    ('Stavria Morfi', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=14354811989597869308&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 902484', 35.1544976, 33.3566262, 'stavria-morfi-limassol'),
    ('Stefanie Christodoulou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=16561029739223554903&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 199552', 34.9199634, 33.6163859, 'stefanie-christodoulou-limassol'),
    ('Stephen Josephides', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=7957929019861130244&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 748748', 34.682477, 33.0394609999999, 'stephen-josephides-limassol'),
    ('Vasilis Hadjivasilis', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=13040264062197290652&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.679867, 33.0355152, 'vasilis-hadjivasilis-limassol'),
    ('Vasilis Vasiliou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=2971828704492471966&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 538418', 35.1373493, 33.352878, 'vasilis-vasiliou-limassol'),
    ('Yvoni Konstantinou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=10733337593752266663&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 268711', 34.6695408, 33.0160185999999, 'yvoni-konstantinou-limassol'),
    ('Zoi Minou', 'Psychiatry', 'Limassol', 'https://maps.google.com/?cid=11372042991626342210&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '94 048080', 35.171481, 33.3505065999999, 'zoi-minou-limassol'),
    ('Charis Efraimi', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=8123257856330550389&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 459030', 35.1714671, 33.3506103, 'charis-efraimi-nicosia'),
    ('Christos Kyprianou', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=2403806815171468395&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 774413', 35.1576158999999, 33.3671456, 'christos-kyprianou-nicosia'),
    ('Demetris Skourides', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=9080141496200791986&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 330520', 35.1490854, 33.3924814999999, 'demetris-skourides-nicosia'),
    ('Despoina Kyriakou', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=11351755500378813884&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 322918', 35.1425929, 33.3682459, 'despoina-kyriakou-nicosia'),
    ('Elina Demetriadou', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=14472856241882133751&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 815140', 35.1653905, 33.3665199, 'elina-demetriadou-nicosia'),
    ('Gregoris Gregoriou', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=6410112986448760793&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 669901', 35.1573292, 33.3153656, 'gregoris-gregoriou-nicosia'),
    ('Irina Michaelidou', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=6283237870832228696&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '95 174858', 35.1552183, 33.3538008999999, 'irina-michaelidou-nicosia'),
    ('Machi Cleanthous', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=8812381774694480237&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 778811', 35.1666698, 33.3695295, 'machi-cleanthous-nicosia'),
    ('Maria Photiades', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=17442618547094470997&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 169832', 35.1669731, 33.3633143, 'maria-photiades-nicosia'),
    ('Neriman Fidanli', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=7675951527780585591&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '0548 821 02 11', 35.2063322, 33.3114966, 'neriman-fidanli-nicosia'),
    ('Nikos Aspris', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=3927125678421440826&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 690646', 35.1689189999999, 33.368612, 'nikos-aspris-nicosia'),
    ('Orestis Kasinopoulos', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=11224619927374862177&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 454398', 35.1593792, 33.3448215999999, 'orestis-kasinopoulos-nicosia'),
    ('Sofoklis Yiannakou', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=12273851779601349136&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 423400', 35.133693, 33.3288418, 'sofoklis-yiannakou-nicosia'),
    ('Theodora Constantinou', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=14373495897798038143&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 763644', 34.9437277, 33.5952362999999, 'theodora-constantinou-nicosia'),
    ('Vassilis Kafetzopoulos', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=11138084349449645170&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 428200', 35.1715252, 33.3506382, 'vassilis-kafetzopoulos-nicosia'),
    ('Vassilis Kafetzopoulos', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=7065131659566789494&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 263214', 35.171481, 33.3505065999999, 'vassilis-kafetzopoulos-nicosia-2'),
    ('Yiannis Yiannopoulos', 'Psychiatry', 'Nicosia', 'https://maps.google.com/?cid=4097315639706609372&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 584810', 35.1571105, 33.3447234, 'yiannis-yiannopoulos-nicosia'),
    ('Alexander Calatzis', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=4765586029187493851&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '95 599401', 34.6770233999999, 33.0187397, 'alexander-calatzis-paphos'),
    ('Alexia Ioannidou', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=6485749435894401983&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 123880', 34.6981675, 32.9592582, 'alexia-ioannidou-paphos'),
    ('Andis Tillyris', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=14041684799596665073&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '94 091153', 34.6821556, 33.0350743, 'andis-tillyris-paphos'),
    ('Charis Antoniou', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=7714303231603522956&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '95 586584', 34.7806232999999, 32.4305373, 'charis-antoniou-paphos'),
    ('Christina Stavrinidou', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=5213355800381122105&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 956488', 34.787272, 32.4393366, 'christina-stavrinidou-paphos'),
    ('Christina Stavrinidou', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=464925884742091079&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 956488', 34.787272, 32.4393366, 'christina-stavrinidou-paphos-2'),
    ('Christos Theofanous', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=7301991024357245961&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 778590', 34.6811591999999, 33.042936, 'christos-theofanous-paphos'),
    ('Constantinos Stylianou', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=11923603018945213416&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 471500', 34.7893147, 32.4320296, 'constantinos-stylianou-paphos'),
    ('Constantinos Stylianou', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=1648870825134540161&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 471500', 34.7893147, 32.4320296, 'constantinos-stylianou-paphos-2'),
    ('Fytoula Metaxa', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=300548469608755806&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '94 320032', 34.775513, 32.4207117, 'fytoula-metaxa-paphos'),
    ('George Mikellides', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=1002206732304211122&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 430330', 35.1115932999999, 33.3681201, 'george-mikellides-paphos'),
    ('George Mikellides', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=8249033178525262356&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 430330', 35.1617175, 33.3742521, 'george-mikellides-paphos-2'),
    ('George Pepetsios', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=15002950913729295157&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 878710', 34.7792451, 32.4316241, 'george-pepetsios-paphos'),
    ('Georgia Konstantinou', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=13446586343452457149&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 826233', 34.7842061, 32.4299801999999, 'georgia-konstantinou-paphos'),
    ('Georgina Sarika', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=14943462510182054898&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 965424', 34.7806232999999, 32.4305373, 'georgina-sarika-paphos'),
    ('Ioulia Maimari', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=248688878719449641&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 790184', 34.7824686999999, 32.4418137, 'ioulia-maimari-paphos'),
    ('Ivy Orphanides', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=11841635878616101664&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 319757', 34.7898217, 32.4390463, 'ivy-orphanides-paphos'),
    ('Katerina Mavrommati', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=7055370503694604338&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 143940', 34.682375, 33.0175099, 'katerina-mavrommati-paphos'),
    ('Konstantinos Efthymiou', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=1805821513380553760&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 427474', 34.787272, 32.4393366, 'konstantinos-efthymiou-paphos'),
    ('Maria Nikolaou', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=1866923049228170061&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 354949', 34.7815605, 32.4382115999999, 'maria-nikolaou-paphos'),
    ('Maria-Eva Tsola', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=7991078349960501998&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 944490', 34.7721263, 32.4284943, 'maria-eva-tsola-paphos'),
    ('Marios Efstathiou', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=10947871357008944712&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 255830', 35.135041, 33.3500856, 'marios-efstathiou-paphos'),
    ('Martha Fragkou', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=7362588500834145362&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 311131', 34.6815689999999, 33.0368452, 'martha-fragkou-paphos'),
    ('Mary Eliadi', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=10548682824047204321&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 658257', 34.7874185, 32.4328779, 'mary-eliadi-paphos'),
    ('Neophytos Theodorides', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=5882203737478922817&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 777210', 34.6963692, 33.0332171, 'neophytos-theodorides-paphos'),
    ('Olympia Evagorou', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=7202155810845651600&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 622232', 34.7846104, 32.4416572, 'olympia-evagorou-paphos'),
    ('Panayotis Kastanos', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=415899469078145684&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.7931933, 32.4421227, 'panayotis-kastanos-paphos'),
    ('Pantelitsa Savva', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=8985571578377935377&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 789180', 34.7825841999999, 32.4296291, 'pantelitsa-savva-paphos'),
    ('Themoulla Efrem', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=9161313357142638329&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 549853', 34.7820951, 32.4429553999999, 'themoulla-efrem-paphos'),
    ('Vassilis Panagopoulos', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=14214928832746888165&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 277944', 34.679603, 33.032523, 'vassilis-panagopoulos-paphos'),
    ('Zinonas Evagorou', 'Psychiatry', 'Paphos', 'https://maps.google.com/?cid=17969968916548080974&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 936220', 34.7846104, 32.4416572, 'zinonas-evagorou-paphos')
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
