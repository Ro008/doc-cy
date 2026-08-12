-- P2 anti-scraping: honeytoken / canary listings for legal proof of directory copying.
-- Fingerprints live in lib/directory-canaries.ts (phones +35799041801–806, unique Maps cids).
-- Visible in finder; excluded from sitemap by app code.

INSERT INTO public.directory_manual (
  id,
  name,
  specialty,
  district,
  address_maps_link,
  phone,
  latitude,
  longitude,
  slug,
  address,
  is_archived
)
SELECT
  v.id,
  v.name,
  v.specialty,
  v.district::public.cyprus_district,
  v.address_maps_link,
  v.phone,
  v.latitude,
  v.longitude,
  v.slug,
  v.address,
  false
FROM (
  VALUES
    (
      'c0418010-d0cc-4a01-8001-cafebabe0001'::uuid,
      'Melina Orphanidou',
      'Nutrition & Dietetics',
      'Famagusta',
      'https://maps.google.com/?cid=9048173620148202601&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA',
      '+35799041801',
      35.12641::double precision,
      33.94371::double precision,
      'melina-orphanidou-famagusta',
      'Famagusta, Cyprus'
    ),
    (
      'c0418020-d0cc-4a01-8002-cafebabe0002'::uuid,
      'Stavros Pelides',
      'ENT',
      'Famagusta',
      'https://maps.google.com/?cid=9048173620148202602&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA',
      '+35799041802',
      35.12711::double precision,
      33.94421::double precision,
      'stavros-pelides-famagusta',
      'Famagusta, Cyprus'
    ),
    (
      'c0418030-d0cc-4a01-8003-cafebabe0003'::uuid,
      'Ioanna Meletiou',
      'Rheumatology',
      'Larnaca',
      'https://maps.google.com/?cid=9048173620148202603&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA',
      '+35799041803',
      34.92211::double precision,
      33.62341::double precision,
      'ioanna-meletiou-larnaca',
      'Larnaca, Cyprus'
    ),
    (
      'c0418040-d0cc-4a01-8004-cafebabe0004'::uuid,
      'Kyriakos Demetriades',
      'Pulmonology',
      'Famagusta',
      'https://maps.google.com/?cid=9048173620148202604&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA',
      '+35799041804',
      35.12801::double precision,
      33.94501::double precision,
      'kyriakos-demetriades-famagusta',
      'Famagusta, Cyprus'
    ),
    (
      'c0418050-d0cc-4a01-8005-cafebabe0005'::uuid,
      'Marilena Sofocleous',
      'Nephrology',
      'Larnaca',
      'https://maps.google.com/?cid=9048173620148202605&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA',
      '+35799041805',
      34.92301::double precision,
      33.62411::double precision,
      'marilena-sofocleous-larnaca',
      'Larnaca, Cyprus'
    ),
    (
      'c0418060-d0cc-4a01-8006-cafebabe0006'::uuid,
      'Petros Athanasiades',
      'Gastroenterology',
      'Famagusta',
      'https://maps.google.com/?cid=9048173620148202606&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA',
      '+35799041806',
      35.12881::double precision,
      33.94581::double precision,
      'petros-athanasiades-famagusta',
      'Famagusta, Cyprus'
    )
) AS v(
  id,
  name,
  specialty,
  district,
  address_maps_link,
  phone,
  latitude,
  longitude,
  slug,
  address
)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.directory_manual existing
  WHERE existing.id = v.id
     OR (existing.slug IS NOT NULL AND lower(existing.slug) = lower(v.slug))
     OR (existing.phone IS NOT NULL AND existing.phone = v.phone)
);
