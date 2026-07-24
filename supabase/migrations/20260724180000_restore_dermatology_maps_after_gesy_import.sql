-- Restore curated Dermatology listings with Maps/coords after GeSY import
-- wiped UUID-matched enrich rows on prod (20260723113000 delete without ghs_code).
-- Idempotent: insert only when ghs_code is not already present.

insert into public.directory_manual (
  name,
  specialty,
  district,
  address_maps_link,
  phone,
  latitude,
  longitude,
  slug,
  ghs_code,
  email,
  gender,
  address,
  is_gesy
)
select
  v.name,
  v.specialty,
  v.district,
  v.address_maps_link,
  v.phone,
  v.latitude,
  v.longitude,
  v.slug,
  v.ghs_code,
  v.email,
  v.gender,
  v.address,
  v.is_gesy
from (
  values
  ('Andreas Christodoulou', 'Dermatology', 'Larnaca'::public.cyprus_district, 'https://maps.google.com/?cid=18217091621498105962&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 660321', 34.9290590999999, 33.6345908, 'andreas-christodoulou', 'D3129', 'andreasch36@gmail.com', 'Male', null, true),
  ('Andreas Fellas', 'Dermatology', 'Nicosia'::public.cyprus_district, 'https://maps.google.com/?cid=530865020058358826&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 767257', 35.1669456, 33.3677172, 'andreas-fellas', 'D3285', 'afellas1@primehome.com', 'Male', null, true),
  ('Andreas Pallouras', 'Dermatology', 'Larnaca'::public.cyprus_district, 'https://maps.google.com/?cid=5532376285171920&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 656373', 34.9176893, 33.6364175, 'andreas-pallouras', 'D2937', 'drandreas@pallourasdermatology.com', 'Male', null, true),
  ('Andreas Symeou', 'Dermatology', 'Nicosia'::public.cyprus_district, 'https://maps.google.com/?cid=11837856517155632866&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 753200', 35.1649763, 33.3667107, 'andreas-symeou', 'D1611', 'asymeou@gmail.com', 'Male', null, true),
  ('Androulla Spiritou Kontidou', 'Dermatology', 'Limassol'::public.cyprus_district, 'https://maps.google.com/?cid=3076526083034060313&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 735333', 34.6879464999999, 33.0342193, 'androulla-spiritou-kontidou', 'D3666', 'aspiritou@gmail.com', 'Female', null, true),
  ('Charalambos Charalambous', 'Dermatology', 'Nicosia'::public.cyprus_district, 'https://maps.google.com/?cid=7883720163713119139&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 314107', 35.1407385, 33.3390544, 'charalambos-charalambous', 'D1709', 'drchar@spidernet.com.cy', 'Male', null, true),
  ('Christiana Zacharia Sotiriou', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=4278115272769677560&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 543544', 35.1419049, 33.3402361, 'christiana-zacharia-sotiriou', 'D5972', 'christianazacharia2@gmail.com', 'Female', null, true),
  ('Christos Pallouras', 'Dermatology', 'Nicosia'::public.cyprus_district, 'https://maps.google.com/?cid=4954986150872989680&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 656373', 34.9177982, 33.6363695, 'christos-pallouras', 'D2902', 'drchristos@pallourasdermatology.com', 'Male', null, true),
  ('Christos Papadimitriou', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=10934222198942018948&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 260060', 34.6835492, 33.0443188, 'christos-papadimitriou', 'D3840', 'papajimx@hotmail.com', 'Male', null, true),
  ('Constantinos Symeonides', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=17234369917996506769&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 356160', 35.1552319, 33.3333145, 'constantinos-symeonides', 'D3634', 'Skinlabcy@gmail.com', 'Male', null, true),
  ('Dimitrios Christou', 'Dermatology', 'Nicosia'::public.cyprus_district, 'https://maps.google.com/?cid=526882754195288131&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 283134', 35.1657142, 33.3668933999999, 'dimitrios-christou', 'D5940', 'doctor@dimisderma.com', 'Male', null, true),
  ('Eftychia Angelou', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=10723503445663312990&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 274707', 34.7907066, 32.4380595, 'eftychia-angelou', 'D6364', 'eangelou@dermainfocus.com', 'Female', null, true),
  ('Eleni Iosifidou', 'Dermatology', 'Larnaca'::public.cyprus_district, 'https://maps.google.com/?cid=11541728078912315714&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 641111', 34.931369, 33.6162219, 'eleni-iosifidou', 'D3413', 'helen.iosifidou@gmail.com', 'Female', null, true),
  ('Elmina Koulounti', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=7073714159989032104&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99649010', 34.6807991, 33.0389957, 'elmina-koulounti', 'D4765', 'dr.e.koulounti@gmail.com', 'Female', null, true),
  ('Evagoras Kyriacou', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=2223549100238208997&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 749400', 34.6811624, 33.0421627, 'evagoras-kyriacou', 'D5484', 'drevagoraskyriakou@outlook.com', 'Male', null, true),
  ('Georgiadis Georgios', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=6941287940134304390&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 762522', 34.69601, 33.0454374, 'georgiadis-georgios', 'D3766', 'dr.georgiadisg@hotmail.com', 'Male', null, true),
  ('Georgina Sarika', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=14943462510182054898&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 965424', 34.7806232999999, 32.4305373, 'georgina-sarika', 'D4997', 'drsarikadermatology@gmail.com', 'Female', null, true),
  ('Giannis Chatzimichail', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=5461004835760835239&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 522152', 34.6816169999999, 33.0117294, 'giannis-chatzimichail', 'D4679', 'yiannishpatra84@gmail.com', 'Male', null, true),
  ('Giorgos Ioannides', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=11568895055681577554&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 373792', 34.6834676, 33.0417942, 'giorgos-ioannides', 'D2333', 'OKYPY411@hio.org.cy', 'Male', null, true),
  ('Iasonas Hadjigeorgiou', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=11391249350631860511&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 757373', 35.1411009, 33.3382222, 'iasonas-hadjigeorgiou', 'D2287', 'iasonash@yahoo.gr', 'Male', null, true),
  ('Iosif Iosifidis', 'Dermatology', 'Nicosia'::public.cyprus_district, 'https://maps.google.com/?cid=7189561354170040175&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '99 630370', 35.1485179, 33.3849161, 'iosif-iosifidis', 'D4591', 'iosifidisi52@gmail.com', 'Male', null, true),
  ('Korina Tryfonos', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=9115583058084629147&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 822777', 34.7894721, 32.4403037999999, 'korina-tryfonos', 'D6032', 'derma.kk@hotmail.com', 'Female', null, true),
  ('Kyriakos Koutsoftas', 'Dermatology', 'Nicosia'::public.cyprus_district, 'https://maps.google.com/?cid=8922569379044634775&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22603000', 35.1033475, 33.3795524, 'kyriakos-koutsoftas', 'D2498', 'OKYPY255@hio.org.cy', 'Male', null, true),
  ('Lakis Orthodoxou', 'Dermatology', 'Larnaca'::public.cyprus_district, 'https://maps.google.com/?cid=5839823294988344898&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24651500', 34.9150574999999, 33.6367283, 'lakis-orthodoxou', 'D3161', 'ortholak@cytanet.com.cy', 'Male', null, true),
  ('Loris Kyriakou', 'Dermatology', 'Nicosia'::public.cyprus_district, 'https://maps.google.com/?cid=1878138157616236542&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 466464', 35.1678709, 33.3715064, 'loris-kyriakou', 'D2112', 'loris@netmail.com.cy', 'Male', null, true),
  ('Maria Moiseos', 'Dermatology', 'Larnaca'::public.cyprus_district, 'https://maps.google.com/?cid=12843975585636279065&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '24 654684', 34.9305035, 33.6225954999999, 'maria-moiseos', 'D3401', 'm.moyseos@gmail.com', 'Female', null, true),
  ('Maria Zaoura', 'Dermatology', 'Limassol'::public.cyprus_district, 'https://maps.google.com/?cid=10664717028073562060&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 723120', 34.6966525, 33.0503632, 'maria-zaoura', 'D3731', 'mzaoura@cytanet.com.cy', 'Female', null, true),
  ('Sotia Meliou', 'Dermatology', 'Nicosia'::public.cyprus_district, 'https://maps.google.com/?cid=3446344436444190158&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 444100', 35.1784495, 33.3821504, 'sotia-meliou', 'D5491', 'sot_mel@hotmail.com', 'Female', null, true),
  ('Stamatina Verykiou', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=6227482763842181679&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 582299', 34.6838623999999, 33.0440111, 'stamatina-verykiou', 'D4184', 'matinaverykiou@hotmail.com', 'Female', null, true),
  ('Stelios Mina', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=1247111867936580518&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 335500', 34.6962161, 33.0313650999999, 'stelios-mina', 'D1448', 'minasstelios@hotmail.com', 'Male', null, true),
  ('Valentina Oflidou', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=1665628448012477822&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '26 221045', 34.7895889, 32.4393615, 'valentina-oflidou', 'D5764', 'drvalentinaoflidou@outlook.com.gr', 'Female', null, true),
  ('Vera Politou', 'Dermatology', 'Paphos'::public.cyprus_district, 'https://maps.google.com/?cid=15591583625893490566&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '97 648413', 34.7813584999999, 32.4263197, 'vera-politou', 'D3253', 'dr.vpolitou@gmail.com', 'Female', null, true),
  ('Vily Tanousheva Papacharalambous', 'Dermatology', 'Nicosia'::public.cyprus_district, 'https://maps.google.com/?cid=6149716404073094984&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '22 375900', 35.1653018999999, 33.3723062, 'vily-tanousheva-papacharalambous', 'D3473', 'drvilypapacharalambous@hotmail.com', 'Female', null, true),
  ('Yiannis Koulountis', 'Dermatology', 'Limassol'::public.cyprus_district, 'https://maps.google.com/?cid=9964229197038128656&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA', '25 341318', 34.6808178, 33.0390693999999, 'yiannis-koulountis', 'D3305', 'dr.yianniskoulountis@gmail.com', 'Male', null, true)
) as v(
  name,
  specialty,
  district,
  address_maps_link,
  phone,
  latitude,
  longitude,
  slug,
  ghs_code,
  email,
  gender,
  address,
  is_gesy
)
where not exists (
  select 1
  from public.directory_manual d
  where d.is_archived = false
    and d.ghs_code is not null
    and d.ghs_code = v.ghs_code
);

-- Ensure badge for any Dermatology row already linked to GeSY.
update public.directory_manual
set is_gesy = true
where is_archived = false
  and specialty = 'Dermatology'
  and ghs_code is not null
  and btrim(ghs_code) <> '';
