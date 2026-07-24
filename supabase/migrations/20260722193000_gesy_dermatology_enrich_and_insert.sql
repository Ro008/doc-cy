-- GeSY Dermatology: enrich matched manual rows + insert approved new providers.
-- Internal-only fields: ghs_code, email, gender (not shown in public UI yet).
-- ENRICH: keep district / Maps / lat / lon; do not write GeSY address text.
-- INSERT: 45 new rows (excludes Katerina Michaelidou D2814, Nikolay Syrtchin D4170).
-- address_maps_link / coords left null until Places enrichment.

alter table public.directory_manual
  add column if not exists ghs_code text;

alter table public.directory_manual
  add column if not exists email text;

alter table public.directory_manual
  add column if not exists gender text;

alter table public.directory_manual
  add column if not exists address text;

comment on column public.directory_manual.ghs_code is
  'GeSY provider code (prvId). Internal / ops use; not shown on public finder cards.';

comment on column public.directory_manual.email is
  'Contact email from GeSY (or later claim). Internal / outreach; not shown on public finder cards.';

comment on column public.directory_manual.gender is
  'Gender from GeSY (Female/Male). Internal; not shown on public finder cards.';

comment on column public.directory_manual.address is
  'Plain-text clinic address for display when available. Prefer curated Maps for location truth.';

-- Allow GeSY-sourced rows without a curated Google Maps URL yet.
alter table public.directory_manual
  alter column address_maps_link drop not null;

create unique index if not exists directory_manual_ghs_code_unique_idx
  on public.directory_manual (ghs_code)
  where ghs_code is not null and is_archived = false;

-- Enrich matched existing Dermatology rows
update public.directory_manual
set
  ghs_code = 'D3129',
  email = 'andreasch36@gmail.com',
  gender = 'Male'
where id = '1b27e6d5-efdb-4331-b00a-cbd42ad66193'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D3285',
  email = 'afellas1@primehome.com',
  gender = 'Male'
where id = 'cc00fe42-02a6-4146-bf0a-f0cdb414513c'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D2937',
  email = 'drandreas@pallourasdermatology.com',
  gender = 'Male'
where id = 'e1ffa296-c0b7-4db7-b681-4430d046a2a5'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D1611',
  email = 'asymeou@gmail.com',
  gender = 'Male'
where id = '9749c476-94f0-46f1-8b40-7d79fc4c997e'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D3666',
  email = 'aspiritou@gmail.com',
  gender = 'Female'
where id = 'c1b910aa-0458-4945-abc0-bfdc46203cbc'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D6364',
  email = 'eangelou@dermainfocus.com',
  gender = 'Female'
where id = 'bd2264c2-5cae-4421-b0c3-077dda826a37'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D3413',
  email = 'helen.iosifidou@gmail.com',
  gender = 'Female'
where id = '75e9b0e6-f38c-4063-b67d-3eece5b862cc'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D4591',
  email = 'iosifidisi52@gmail.com',
  gender = 'Male'
where id = '7879eb95-1cb4-461d-bf0f-221834ba7de4'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D6032',
  email = 'derma.kk@hotmail.com',
  gender = 'Female'
where id = '0b79a8da-5143-4f47-af58-1e75ab0d83d5'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D2498',
  email = 'OKYPY255@hio.org.cy',
  gender = 'Male',
  phone = coalesce(nullif(trim(phone), ''), '22603000')
where id = 'dd80a490-5f82-48f8-8bd1-090f6e3a8c10'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D3731',
  email = 'mzaoura@cytanet.com.cy',
  gender = 'Female'
where id = 'dd5c8587-c914-4322-b3ee-15f7fde708bb'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D5764',
  email = 'drvalentinaoflidou@outlook.com.gr',
  gender = 'Female'
where id = '039340b2-aa50-441a-9027-e92b946611b4'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D3253',
  email = 'dr.vpolitou@gmail.com',
  gender = 'Female'
where id = 'e53a816b-7d37-4c76-9173-6980e0562b1d'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D1709',
  email = 'drchar@spidernet.com.cy',
  gender = 'Male'
where id = '3a1e5589-db88-48f0-90c0-9ce0a2f432a3'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D5972',
  email = 'christianazacharia2@gmail.com',
  gender = 'Female'
where id = 'c267a810-86dc-499d-b5ab-bd7e3e9e8e72'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D2902',
  email = 'drchristos@pallourasdermatology.com',
  gender = 'Male'
where id = '711a3e6f-681e-4aaf-b63d-49d5ed15aa4e'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D3840',
  email = 'papajimx@hotmail.com',
  gender = 'Male'
where id = '36cb7dbd-7964-4e05-b2d4-79478a2ce5c8'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D3634',
  email = 'Skinlabcy@gmail.com',
  gender = 'Male'
where id = 'ded9d67e-daca-4ed4-95c3-eed008573d91'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D5940',
  email = 'doctor@dimisderma.com',
  gender = 'Male'
where id = '3b046248-e86a-4097-8121-7de2909a2d09'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D4765',
  email = 'dr.e.koulounti@gmail.com',
  gender = 'Female',
  phone = coalesce(nullif(trim(phone), ''), '99649010')
where id = '62eccc47-c9b9-4158-a082-b08d9e46e628'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D5484',
  email = 'drevagoraskyriakou@outlook.com',
  gender = 'Male'
where id = '3df5bd10-a2e6-44f6-8f08-c54330185efb'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D4997',
  email = 'drsarikadermatology@gmail.com',
  gender = 'Female'
where id = '402d1470-7676-4885-aa2a-bd31d1b8e41e'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D3766',
  email = 'dr.georgiadisg@hotmail.com',
  gender = 'Male'
where id = '467d95f2-9a45-4cdd-84bf-eee7427bc612'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D2333',
  email = 'OKYPY411@hio.org.cy',
  gender = 'Male'
where id = 'fc29d506-82a9-4430-8925-c82f9e12ebb3'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D4679',
  email = 'yiannishpatra84@gmail.com',
  gender = 'Male'
where id = '5287cb8d-54a7-470a-8108-4788b1074e81'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D2287',
  email = 'iasonash@yahoo.gr',
  gender = 'Male'
where id = '24538829-f25f-4c98-8158-5e108b63d9f7'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D2112',
  email = 'loris@netmail.com.cy',
  gender = 'Male'
where id = 'cb9b0483-d46c-4d2d-a3d4-4e15e240b828'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D3401',
  email = 'm.moyseos@gmail.com',
  gender = 'Female'
where id = '0b731444-9c26-4645-99c6-c43264d1ce22'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D3161',
  email = 'ortholak@cytanet.com.cy',
  gender = 'Male',
  phone = coalesce(nullif(trim(phone), ''), '24651500')
where id = '9041f855-554d-4d97-8e8c-9e4f525e81bb'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D5491',
  email = 'sot_mel@hotmail.com',
  gender = 'Female'
where id = '9270ba57-8c99-4dcd-9abb-d3c8e1ec7d47'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D4184',
  email = 'matinaverykiou@hotmail.com',
  gender = 'Female'
where id = '08b70a76-2b90-4c34-8f45-caec156ac355'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D1448',
  email = 'minasstelios@hotmail.com',
  gender = 'Male'
where id = '90a48fe9-c01a-4be4-a27a-30730f15de28'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D3473',
  email = 'drvilypapacharalambous@hotmail.com',
  gender = 'Female'
where id = 'fc5071c2-4610-4373-b449-1e38b929d838'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

update public.directory_manual
set
  ghs_code = 'D3305',
  email = 'dr.yianniskoulountis@gmail.com',
  gender = 'Male'
where id = 'e6130385-3178-4287-849b-c7c83d8b78db'::uuid
  and specialty = 'Dermatology'
  and is_archived = false;

-- Insert approved new GeSY Dermatology rows
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
  address
)
select
  v.name,
  v.specialty,
  v.district::public.cyprus_district,
  v.address_maps_link,
  v.phone,
  v.latitude::double precision,
  v.longitude::double precision,
  v.slug,
  v.ghs_code,
  v.email,
  v.gender,
  v.address
from (
  values
  ('Akis Kastellanos', 'Dermatology', 'Nicosia', null, '99623866', null, null, 'akis-kastellanos-nicosia', 'D1744', 'kostantinos.kastellanos@gmail.com', 'Male', 'Kalypsous 28, Flat 22, Akropoli, Strovolos, 2014, Nicosia'),
  ('Alexandros Doumouzelis', 'Dermatology', 'Nicosia', null, '22603000', null, null, 'alexandros-doumouzelis-nicosia', 'D3770', 'dumuzelis@gmail.com', 'Male', 'Palaios Dromos Levkosias Lemesou, No. 215, Strovolos, 2029, Nicosia'),
  ('Alexandros Vasiadis', 'Dermatology', 'Famagusta', null, '23200000', null, null, 'alexandros-vasiadis-famagusta', 'D4723', 'a.vasiadis@shso.org.cy', 'Male', 'Ippokratous 0, Paralimni, 5297, Famagusta'),
  ('Ampir Or Abir Nasr Leikou', 'Dermatology', 'Limassol', null, '99487371', null, null, 'ampir-or-abir-nasr-leikou-limassol', 'D4991', 'margaritanasr@gmail.com', 'Female', 'Antisthenous 9, Lemesos, 3086, Limassol'),
  ('Anastasia Gregoriou', 'Dermatology', 'Nicosia', null, '22603000', null, null, 'anastasia-gregoriou-nicosia', 'D2096', 'OKYPY166@hio.org.cy', 'Female', 'Palaios Dromos Levkosias Lemesou, No. 215, Strovolos, 2029, Nicosia'),
  ('Andreas Hadjigeorgiou', 'Dermatology', 'Nicosia', null, '99611929', null, null, 'andreas-hadjigeorgiou-nicosia', 'D2881', 'dr.hadjigeorgiou@cytanet.com.cy', 'Male', 'Ilia Venezi 2, Flat 203, Strovolos, 2042, Nicosia'),
  ('Andriani Charalambous', 'Dermatology', 'Nicosia', null, '22042101', null, null, 'andriani-charalambous-nicosia', 'D6499', 'andriani.charalambous@gmail.com', 'Female', 'Athinon 19, Strovolos, 2020, Nicosia'),
  ('Androula Kerkidou Kyprianou', 'Dermatology', 'Nicosia', null, '99598000', null, null, 'androula-kerkidou-kyprianou-nicosia', 'D3505', 'androulakyprianou@hotmail.com', 'Female', 'Stasandrou 6A, Egkomi Lefkosias, 2401, Nicosia'),
  ('Androulla Vasiliadou', 'Dermatology', 'Paphos', null, '95767721', null, null, 'androulla-vasiliadou-paphos', 'D2697', 'rv00@aubmed.ac.cy', 'Female', 'Adonidos 36, Pafos, 8010, Paphos'),
  ('Anna Maria Flouri', 'Dermatology', 'Famagusta', null, '99605522', null, null, 'anna-maria-flouri-famagusta', 'D2813', 'anna.flouri@cytanet.com.cy', 'Female', 'Sotiras 8, Paralimni, 5286, Famagusta'),
  ('Anna Spanou', 'Dermatology', 'Larnaca', null, '24823473', null, null, 'anna-spanou-larnaca', 'D2699', 'OKYPY541@hio.org.cy', 'Female', 'Grigoriou Avxentiou Avenue 40, Larnaka, 6023, Larnaca'),
  ('Antonietta Koursari', 'Dermatology', 'Larnaca', null, '99490715', null, null, 'antonietta-koursari-larnaca', 'D3400', 'antoniettakoursari@gmail.com', 'Female', 'Grigoriou Avxentiou Avenue 35, Flat 205, Larnaka, 6021, Larnaca'),
  ('Antonis Kyriakou', 'Dermatology', 'Limassol', null, '99378755', null, null, 'antonis-kyriakou-limassol', 'D3552', 'antoniskyriakou52@gmail.com', 'Male', 'Gladstonos 38, Flat 11, Lemesos, 3041, Limassol'),
  ('Christina Philippou Shiakalli', 'Dermatology', 'Nicosia', null, '99479165', null, null, 'christina-philippou-shiakalli-nicosia', 'D2171', 'cshiakal@gmail.com', 'Female', 'Tompazi 73, Lefkosia, 1055, Nicosia'),
  ('Christodoulos Georgallis', 'Dermatology', 'Nicosia', null, '99306779', null, null, 'christodoulos-georgallis-nicosia', 'D2511', 'c.georgallis@cytanet.com.cy', 'Male', 'Stasandrou 10, Flat 302, Lefkosia, 1060, Nicosia'),
  ('Christoforos Loizides', 'Dermatology', 'Paphos', null, '99078706', null, null, 'christoforos-loizides-paphos', 'D3715', 'drloizides@gmail.com', 'Male', 'Avenue Dimokratias 12, Pafos, 8028, Paphos'),
  ('Despina Pavlidou', 'Dermatology', 'Larnaca', null, '22502246', null, null, 'despina-pavlidou-larnaca', 'D3464', 'despavlidou@gmail.com', 'Female', 'Mystra 2, Diam.102, Egkomi Lefkosias, 2408, Nicosia'),
  ('Eleni Christofi Apostolou', 'Dermatology', 'Nicosia', null, '99605968', null, null, 'eleni-christofi-apostolou-nicosia', 'D3148', 'eleni-christofi@hotmail.com', 'Female', 'Kritis 11, Flat 21, Lefkosia, 1061, Nicosia'),
  ('Eleni Karadima', 'Dermatology', 'Nicosia', null, '96035353', null, null, 'eleni-karadima-nicosia', 'D4127', 'eleni9098@gmail.com', 'Female', 'Avenue Athalassis 101, Office 404, Strovolos, 2013, Nicosia'),
  ('Eleni Koullapi', 'Dermatology', 'Limassol', null, '25801100', null, null, 'eleni-koullapi-limassol', 'D2334', 'elenakoullapi.med@gmail.com', 'Female', 'Nikaias 1, Pano Polemidia, 4131, Limassol'),
  ('Eliada Kyriakidou', 'Dermatology', 'Paphos', null, '26936858', null, null, 'eliada-kyriakidou-paphos', 'D3250', 'iliadakyriakidou@gmail.com', 'Female', 'Vasileos Georgiou 12, Pafos, 8010, Paphos'),
  ('Evangelos Evangelou', 'Dermatology', 'Nicosia', null, '99438664', null, null, 'evangelos-evangelou-nicosia', 'D1955', 'eevangelou33@gmail.com', 'Male', 'Nikodimou Mylona 17, Lefkosia, 1071, Nicosia'),
  ('Georgios Vaki', 'Dermatology', 'Larnaca', null, '24800500', null, null, 'georgios-vaki-larnaca', 'D2700', 'g.vakis@shso.org.cy', 'Male', 'Inomenon Politeion Avenue 0, Larnaka, 6043, Larnaca'),
  ('Irena Kalou', 'Dermatology', 'Famagusta', null, '99802699', null, null, 'irena-kalou-famagusta', 'D3009', 'irinastavros@hotmail.com', 'Female', 'Georgiou Griva Digeni 6G, Liopetri, 5320, Famagusta'),
  ('Kyriakos Polykarpou', 'Dermatology', 'Nicosia', null, '97773939', null, null, 'kyriakos-polykarpou-nicosia', 'D2248', 'kyriakos33@gmail.com', 'Male', 'Strovolou Avenue 290, Strovolos, 2048, Nicosia'),
  ('Maria Fragkou Dragka', 'Dermatology', 'Nicosia', null, '97444558', null, null, 'maria-fragkou-dragka-nicosia', 'D5991', 'fragkou_m@hotmail.com', 'Female', 'Avenue Giannou Kranidioti 53, Latsia, 2220, Nicosia'),
  ('Maria Makaritou Savva', 'Dermatology', 'Nicosia', null, '99657908', null, null, 'maria-makaritou-savva-nicosia', 'D3423', 'savvamary0@gmail.com', 'Female', 'Androkleous 15, Flat 202, Lefkosia, 1061, Nicosia'),
  ('Maria Michaelidou', 'Dermatology', 'Nicosia', null, '22272282', null, null, 'maria-michaelidou-nicosia', 'D4494', 'mariagmichaelidou@gmail.com', 'Female', 'Avlonas 11, Peristerona Lefkosias, 2731, Nicosia'),
  ('Michalis Michaelides', 'Dermatology', 'Nicosia', null, '99153073', null, null, 'michalis-michaelides-nicosia', 'D3055', 'drmichalis@cytanet.com.cy', 'Male', 'Levkotheou Avenue 20, Strovolos, Strovolos, 2054, Nicosia'),
  ('Myria Kyriakidou', 'Dermatology', 'Paphos', null, '99771888', null, null, 'myria-kyriakidou-paphos', 'D3238', 'myriakyriakidou@gmail.com', 'Female', 'Vasileos Georgiou 12, Pafos, 8010, Paphos'),
  ('Myrofora Agapiou', 'Dermatology', 'Limassol', null, '99588871', null, null, 'myrofora-agapiou-limassol', 'D3195', 'agapioumiria@hotmail.com', 'Female', 'Archiepiskopou Makariou G'' Avenue 22, Flat 104, Mesa Geitonia, 4000, Limassol'),
  ('Nestor Papanikolaou', 'Dermatology', 'Limassol', null, '99895005', null, null, 'nestor-papanikolaou-limassol', 'D2264', 'dernestoras@outlook.com', 'Male', 'Apostolou Louka Avenue 54, Flat 204, Kolossi, 4632, Limassol'),
  ('Nicolaos Christophorou', 'Dermatology', 'Nicosia', null, '99723262', null, null, 'nicolaos-christophorou-nicosia', 'D3065', 'cnx.dermatology@gmail.com', 'Male', 'Pindarou 1, Strovolos, 2008, Nicosia'),
  ('Nikos Prastitis', 'Dermatology', 'Limassol', null, '99674074', null, null, 'nikos-prastitis-limassol', 'D2400', 'drnprastitis@gmail.com', 'Male', 'Agias Zonis 30A, Flat 102, Lemesos, 3027, Limassol'),
  ('Panagiotis Gkritzapis', 'Dermatology', 'Nicosia', null, '94614715', null, null, 'panagiotis-gkritzapis-nicosia', 'D6403', 'dr.panos@yahoo.com', 'Male', 'Archiepiskopou Makariou G'' Avenue 33, Flat 101, Latsia, 2220, Nicosia'),
  ('Paraskevi Hadjicosti', 'Dermatology', 'Famagusta', null, '99628488', null, null, 'paraskevi-hadjicosti-famagusta', 'D3124', 'hadjicosti.p@gmail.com', 'Female', 'Vattainas 57, Ormideia, 7530, Larnaca'),
  ('Sofia Germanidou', 'Dermatology', 'Paphos', null, '26803235', null, null, 'sofia-germanidou-paphos', 'D5509', 'germanidou.s@gmail.com', 'Female', 'Archiepiskopou Makariou G'' Avenue 18, Flat 301, Mesa Geitonia, 4000, Limassol'),
  ('Sofia Masouri', 'Dermatology', 'Limassol', null, '99301660', null, null, 'sofia-masouri-limassol', 'D5378', 'sofia.masouri@hotmail.com', 'Female', 'Vasileos Georgiou 14, Flat 201, Pafos, 8010, Paphos'),
  ('Sofia Stamathioudaki', 'Dermatology', 'Limassol', null, '25208000', null, null, 'sofia-stamathioudaki-limassol', 'D4390', 'sofia.stamathioudaki@goc.com.cy', 'Female', 'NIKIS 1, Agios Athanasios, 4108, Limassol'),
  ('Stavros Charamis', 'Dermatology', 'Larnaca', null, '99970333', null, null, 'stavros-charamis-larnaca', 'D4150', 's.charamis@scalamed.com.cy', 'Male', 'Nikou Dimitriou 36, Larnaka, 6031, Larnaca'),
  ('Theodoulos Drousiotis', 'Dermatology', 'Limassol', null, '25208000', null, null, 'theodoulos-drousiotis-limassol', 'D5097', 'drousiotis.t@gmail.com', 'Male', 'NIKIS 1, Agios Athanasios, 4108, Limassol'),
  ('Theophania Tsangari Neophytou', 'Dermatology', 'Nicosia', null, '9956799399487417', null, null, 'theophania-tsangari-neophytou-nicosia', 'D2940', 'theophania@doctor.com', 'Female', 'Spyrou Trikoupi 21, Office 101, Lakatameia, 2311, Nicosia'),
  ('Tony Cheiban', 'Dermatology', 'Nicosia', null, '99469401', null, null, 'tony-cheiban-nicosia', 'D3635', 'tonysheiban@yahoo.com', 'Male', 'Athalassis Avenue 102, Flat 202, Strovolos, 2024, Nicosia'),
  ('Wael Khaddaj', 'Dermatology', 'Nicosia', null, '99210221', null, null, 'wael-khaddaj-nicosia', 'D3522', 'khaddaj.w-a@cytanet.com.cy', 'Male', 'Vasileos Konstantinou A'' 11, Flat 103, Agios Dometios, 2373, Nicosia'),
  ('Zuzana Antoniou', 'Dermatology', 'Nicosia', null, '22100444', null, null, 'zuzana-antoniou-nicosia', 'D6399', 'kajliska@hotmail.com', 'Female', 'Doxis 4, Latsia, 2224, Nicosia')
) as v(name, specialty, district, address_maps_link, phone, latitude, longitude, slug, ghs_code, email, gender, address)
where not exists (
  select 1
  from public.directory_manual d
  where d.is_archived = false
    and (
      d.ghs_code = v.ghs_code
      or (
        lower(d.name) = lower(v.name)
        and d.specialty = v.specialty
        and d.district = v.district::public.cyprus_district
      )
    )
);
