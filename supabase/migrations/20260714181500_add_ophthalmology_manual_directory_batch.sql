-- Append manual directory rows from spreadsheet (Ophtalmologist.xlsx).

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
    ('Photos Alexandrou', 'Ophthalmology', 'Larnaca', 'https://maps.google.com/?cid=10187099556927032675&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 662117', 34.930552, 33.6226003999999, 'photos-alexandrou'),
    ('Andreas Kontos', 'Ophthalmology', 'Limassol', 'https://maps.google.com/?cid=6995677946129145747&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 386300', 34.692515, 33.0166724, 'andreas-kontos'),
    ('Aristos N. Kafkalias', 'Ophthalmology', 'Limassol', 'https://maps.google.com/?cid=17463547146284999186&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 338739', 34.6942499, 33.0342057, 'aristos-n-kafkalias'),
    ('Dimitris Chatzikoutoulis', 'Ophthalmology', 'Limassol', 'https://maps.google.com/?cid=18100050424922756328&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 574800', 34.7003173, 33.0763324, 'dimitris-chatzikoutoulis'),
    ('Dr Kounounis Michalis', 'Ophthalmology', 'Limassol', 'https://maps.google.com/?cid=5947417707715545457&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 818150', 34.6852748999999, 33.0316849, 'dr-kounounis-michalis'),
    ('Eleni Loukianou', 'Ophthalmology', 'Limassol', 'https://maps.google.com/?cid=15776331252345906801&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 383868', 34.6959231, 33.0334954, 'eleni-loukianou'),
    ('Georgios Konstantinou', 'Ophthalmology', 'Limassol', 'https://maps.google.com/?cid=2111719818735028726&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 333146', 34.6826132, 33.042778, 'georgios-konstantinou'),
    ('Iria Evangelatou', 'Ophthalmology', 'Limassol', 'https://maps.google.com/?cid=12141043892447309286&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.705267, 33.0304657, 'iria-evangelatou'),
    ('Marios Lipsos', 'Ophthalmology', 'Limassol', 'https://maps.google.com/?cid=16689209318777314911&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 772424', 34.702346, 33.048271, 'marios-lipsos'),
    ('Miltos Miltiadous', 'Ophthalmology', 'Limassol', 'https://maps.google.com/?cid=4791133009330094324&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 871187', 34.6824162, 33.0457027, 'miltos-miltiadous'),
    ('Niki Lapithi', 'Ophthalmology', 'Limassol', 'https://maps.google.com/?cid=7527830310542903781&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 720275', 35.1555204, 33.3300862, 'niki-lapithi'),
    ('Paris Papamarkou', 'Ophthalmology', 'Limassol', 'https://maps.google.com/?cid=8558381587483243741&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 254625', 34.9214706, 33.6239574999999, 'paris-papamarkou'),
    ('Savvas Ioannou', 'Ophthalmology', 'Limassol', 'https://maps.google.com/?cid=2257990181952748562&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 372003', 34.6824661, 33.0393937, 'savvas-ioannou'),
    ('Theodora Georgouli', 'Ophthalmology', 'Limassol', 'https://maps.google.com/?cid=11518625611849098368&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 464647', 34.6941787999999, 33.0341844999999, 'theodora-georgouli'),
    ('Agia Paraskevi', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=13869667358890598257&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 463400', 35.155877, 33.3717046, 'agia-paraskevi'),
    ('Aliki Louka', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=10485740352273898268&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '94 486900', 35.0520336, 33.9759035999999, 'aliki-louka'),
    ('Anastasia Iacovou', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=7437709070882170048&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 517745', 34.9143425, 33.6306089, 'anastasia-iacovou'),
    ('Dr Ioannis Kyprianou', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=15356387207209755656&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 340041', 35.1561012, 33.391234, 'dr-ioannis-kyprianou'),
    ('Eftychia Kousi', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=2089188103617191636&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 375275', 35.1646511, 33.3722772, 'eftychia-kousi'),
    ('George Mylonas', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=7280295295010782416&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 505621', 34.9079394, 33.6275034, 'george-mylonas'),
    ('George Papamichael', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=14419807481419543354&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 755400', 35.1566071999999, 33.3640295, 'george-papamichael'),
    ('Leonidas Tongas', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=436217604412457360&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 322689', 35.1225461999999, 33.320094, 'leonidas-tongas'),
    ('Louca Georgios', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=1801798169659346545&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '23 824499', 35.033859, 33.9779662, 'louca-georgios'),
    ('Maria Drousiotou', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=13377829942010278809&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 667471', 35.1607228999999, 33.3715095, 'maria-drousiotou'),
    ('Maria Vrahimi', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=8467562580613761563&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 770870', 35.1668588, 33.3670688, 'maria-vrahimi'),
    ('Marios Vayianos', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=1879322065023735970&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 642455', 34.9304397999999, 33.6227237999999, 'marios-vayianos'),
    ('Mavronikolas Kyriakos', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=14574779588994134935&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 753920', 35.1670963, 33.3692354, 'mavronikolas-kyriakos'),
    ('Mersinoglou Andreana', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=10336163866234097877&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 385354', 35.1149945999999, 33.3802632999999, 'mersinoglou-andreana'),
    ('Nestor Nestoros', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=2894580061556392783&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '96 680555', 34.9311633, 33.6140385, 'nestor-nestoros'),
    ('Peter Tsangaris', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=4306133168541564460&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 777206', 35.1566693, 33.3641135, 'peter-tsangaris'),
    ('Petros Aristodemou', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=17713446185631536885&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 878788', 35.1698114, 33.3574714999999, 'petros-aristodemou'),
    ('Prodromos Kontovourkis', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=8974721550130819025&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 641111', 34.931369, 33.6162219, 'prodromos-kontovourkis'),
    ('Santa Vassiliou', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=4945476139209683094&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 722445', 34.9902616, 33.7774049, 'santa-vassiliou'),
    ('Stella Palaikithritou Papakyriakou', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=17244865253245217034&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 517444', 35.1282479, 33.3241392, 'stella-palaikithritou-papakyriakou'),
    ('Topouzi Eleni', 'Ophthalmology', 'Nicosia', 'https://maps.google.com/?cid=14794764320564434388&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 35.1545269, 33.1999815, 'topouzi-eleni'),
    ('Alexandra Koumpi', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=4941166202284227127&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 840653', 34.7893147, 32.4320296, 'alexandra-koumpi'),
    ('Alexandros Georgiou', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=8751194136242741855&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 910110', 34.7845004, 32.4310185, 'alexandros-georgiou'),
    ('Antonis Glykeriou', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=4922361461702538821&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 680780', 35.1538043, 33.3652025999999, 'antonis-glykeriou'),
    ('Antonis Ioannides', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=15446040200137471514&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 352555', 34.6815715, 33.0418111, 'antonis-ioannides'),
    ('Antonis Ioannidis', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=2798318448440168482&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 352555', 34.6816047, 33.0417106999999, 'antonis-ioannidis'),
    ('Antonis Ypsarides', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=2570223134104702865&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 921165', 34.7669676999999, 32.4430198, 'antonis-ypsarides'),
    ('Charis Antoniou', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=7714303231603522956&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '95 586584', 34.7806232999999, 32.4305373, 'charis-antoniou'),
    ('Christos Chamalis', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=8144809463556172243&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 221126', 34.6861145999999, 33.0259407, 'christos-chamalis'),
    ('Christos Tryfonides', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=14328984842394780235&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 751500', 35.1566693, 33.3641135, 'christos-tryfonides'),
    ('Chryso Neophytou Metaxa', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=1937072862366800540&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 951919', 34.7848602, 32.4426783, 'chryso-neophytou-metaxa'),
    ('Chrysostomou Stavroula', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=267990161896286609&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '95 135676', 34.7805876, 32.4305477, 'chrysostomou-stavroula'),
    ('Demosthenous Constantinos', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=10884060149786247325&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 756044', 35.1663141999999, 33.3665622, 'demosthenous-constantinos'),
    ('Ekaterina Fominenkova', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=11572929558199745556&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 145250', 34.7683625999999, 32.4196123, 'ekaterina-fominenkova'),
    ('Elena Papaelissaiou', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=16681234398546994360&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 814434', 34.7100495, 33.0770362, 'elena-papaelissaiou'),
    ('Esther Papamichael', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=6595037355042712675&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 755400', 35.1566693, 33.3641135, 'esther-papamichael'),
    ('Grigoris Chilingaryan', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=4770644126613593952&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 737334', 34.6822795, 33.0405833, 'grigoris-chilingaryan'),
    ('Ionas Miliatos', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=13017423832945817225&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 220202', 34.7812583, 32.4358249, 'ionas-miliatos'),
    ('Kyriaki Evangelatou', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=3571211259119121397&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 730780', 34.7052343, 33.0304803, 'kyriaki-evangelatou'),
    ('Maliotis Neofytos', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=933851431819443222&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 117833', 34.6846118, 33.0287304, 'maliotis-neofytos'),
    ('Maria Papadopoulou', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=8215398105717092359&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 947224', 34.7627525, 32.4383006, 'maria-papadopoulou'),
    ('Maria Phylactou', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=1483807989186247941&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 499999', 35.1410025, 33.3381699, 'maria-phylactou'),
    ('Marina Syrimi', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=2788707933881645567&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 552215', 34.6858417, 33.0501916, 'marina-syrimi'),
    ('Michalis Theocharides', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=1898261028606729917&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 749778', 34.6819549, 33.0441530999999, 'michalis-theocharides'),
    ('Myria Theocharous', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=17682453140765015071&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 101515', 34.6885164, 33.0435242, 'myria-theocharous'),
    ('Neoklis A. Razis', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=4332068643213094945&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 818900', 34.6842916999999, 33.0337649999999, 'neoklis-a-razis'),
    ('Nikolas Stavris', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=4429708087910462016&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 442404', 34.7811592, 32.4364391, 'nikolas-stavris'),
    ('Panagiota Tsimpri', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=10079910151722311204&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '70 006016', 34.6805449999999, 33.0118058, 'panagiota-tsimpri'),
    ('Panayiotis Christou', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=737515886879698096&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 953000', 34.7626503, 32.4177691999999, 'panayiotis-christou'),
    ('Petros Aristodemou', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=12975663200032464543&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 878788', 34.6828091, 33.0382963, 'petros-aristodemou-paphos'),
    ('Savvas Hadjiraftis', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=12446952834326017376&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 947948', 34.7870375, 32.4386911, 'savvas-hadjiraftis'),
    ('Spyros Pipis', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=11009517019923245012&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 777177', 35.1630311, 33.3647741, 'spyros-pipis'),
    ('Stavroula Chrysostomou', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=9139660556895495726&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', null, 34.9893293999999, 32.4889822, 'stavroula-chrysostomou'),
    ('Thalia Evripidou', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=12632245309100039390&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 864028', 34.6885346, 33.0103076, 'thalia-evripidou'),
    ('Theodoros Koinonas', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=17860886173991710560&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 636343', 34.9281852, 33.6330976, 'theodoros-koinonas'),
    ('Valentina Stavrou', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=7961616483879399282&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 930011', 34.7779678, 32.4297417, 'valentina-stavrou'),
    ('Vrionis Kyperesis', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=8414631313915958968&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 575799', 34.6740485, 33.0237389, 'vrionis-kyperesis'),
    ('Yianna Antoniou', 'Ophthalmology', 'Paphos', 'https://maps.google.com/?cid=16021043645722905687&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '70 007740', 34.6856605, 33.030417, 'yianna-antoniou')
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
