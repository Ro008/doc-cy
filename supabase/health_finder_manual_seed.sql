-- Manual curated listings for Health Finder (verified district set).
-- Only required fields: name, specialty, district, address_maps_link.
-- Replace current manual rows with this controlled sample set.

DELETE FROM public.directory_manual;

INSERT INTO public.directory_manual (
  name,
  specialty,
  district,
  address_maps_link
)
VALUES
  (
    'Michaela Koundourou',
    'Pediatric Dentistry',
    'Paphos',
    'https://maps.app.goo.gl/Wh4Ldecmk7Ssg47FA'
  ),
  (
    'Elena Ioannou',
    'Dentistry',
    'Paphos',
    'https://maps.app.goo.gl/8HcbjcDfjJjea8n86'
  ),
  (
    'Nicholas Paphitis',
    'Dentistry',
    'Paphos',
    'https://maps.app.goo.gl/Xgrb3uzkfPYdXXAJ9'
  ),
  (
    'Christos Savva',
    'Dentistry',
    'Paphos',
    'https://maps.app.goo.gl/JNENZebCDnc4rmAH9'
  ),
  (
    'Ariadni Charalambous',
    'Dentistry',
    'Paphos',
    'https://maps.app.goo.gl/4tPtYwy511WzpY4m7'
  ),
  (
    'Xenia Georgiou',
    'Dentistry',
    'Paphos',
    'https://maps.app.goo.gl/Fjpyx28Acyk211tL7'
  ),
  (
    'Nicole Sakka',
    'Dermatology',
    'Limassol',
    'https://maps.app.goo.gl/WnCuTJhF3UyCVisc6'
  ),
  (
    'Margarita Mavrogeni',
    'Dermatology',
    'Limassol',
    'https://maps.app.goo.gl/MSDYUWfLSXjqK7K58'
  ),
  (
    'Charis Lazarou',
    'Dermatology',
    'Limassol',
    'https://maps.app.goo.gl/fdqk3aiP8QUBvtNL9'
  ),
  (
    'Christos Papadimitriou',
    'Dermatology',
    'Limassol',
    'https://maps.app.goo.gl/yPvzGzfiqyLNZ7mT8'
  ),
  (
    'Giannis Chatzimichail',
    'Dermatology',
    'Limassol',
    'https://maps.app.goo.gl/RiDWvJqTMDfwr5Ch9'
  ),
  (
    'Georgina Sarika',
    'Dermatology',
    'Paphos',
    'https://maps.app.goo.gl/6uNG7ajS1UeZU96Q7'
  ),
  (
    'Androulla Spiritou Kontidou',
    'Dermatology',
    'Limassol',
    'https://maps.app.goo.gl/9JEhHMcAN1NErKXv8'
  ),
  (
    'Korina Tryfonos',
    'Dermatology',
    'Paphos',
    'https://maps.app.goo.gl/FwGDUQnrbQKUMasn8'
  ),
  (
    'Valentina Oflidou',
    'Dermatology',
    'Paphos',
    'https://maps.app.goo.gl/RDejcWME7Xr6tZtM6'
  ),
  (
    'Maria Chrysostomou',
    'Physiotherapy',
    'Paphos',
    'https://maps.app.goo.gl/mBDkUE6Brh5BiCAj8'
  ),
  (
    'Jakob Essen',
    'Alternative Medicine',
    'Paphos',
    'https://maps.app.goo.gl/WYxrk82TVK3Hb8Jw7'
  ),
  (
    'Sokratis Sokratous',
    'Physiotherapy',
    'Paphos',
    'https://maps.app.goo.gl/XiBfMgSUJXtX9ExX8'
  ),
  (
    'Omirou Nikolas',
    'Physiotherapy',
    'Paphos',
    'https://maps.app.goo.gl/BT46dU76cHrpx2KE6'
  ),
  (
    'Ivy Orphanides',
    'Psychology',
    'Paphos',
    'https://maps.app.goo.gl/CtBQ4y73RpVo9e2U8'
  ),
  (
    'Nikolas Kyriakou',
    'Physiotherapy',
    'Paphos',
    'https://maps.app.goo.gl/trxnBrQNTmiazmLh8'
  ),
  (
    'Emily Petridou',
    'Occupational Therapy',
    'Paphos',
    'https://maps.app.goo.gl/dtNUhpU8G5rNKzXL7'
  ),
  (
    'George Nikolaou',
    'Physiotherapy',
    'Paphos',
    'https://maps.app.goo.gl/PZMfDYBvWSHzEk5z6'
  ),
  (
    'Annita Afxentiou',
    'Physiotherapy',
    'Paphos',
    'https://maps.app.goo.gl/oAqXQSTaSAxBhpAu7'
  ),
  (
    'Evangelos Demetriou',
    'Physiotherapy',
    'Paphos',
    'https://maps.app.goo.gl/aGHmP21B8jQ5kVD78'
  ),
  (
    'Giannis Drousiotis',
    'Physiotherapy',
    'Paphos',
    'https://maps.app.goo.gl/y33jyAucn6EgXxZr9'
  ),
  (
    'Herodotou Nicos',
    'Physiotherapy',
    'Paphos',
    'https://maps.app.goo.gl/sJzLuMpcAEvXBCZf6'
  ),
  (
    'Andreana Kokkalis',
    'Occupational Therapy',
    'Paphos',
    'https://maps.app.goo.gl/eF7iZDzjobDtm7qP6'
  ),
  (
    'Elinos Petrou',
    'Physiotherapy',
    'Nicosia',
    'https://maps.app.goo.gl/Sdn5Jc7BpGaGC4q49'
  ),
  (
    'Pavlina Solomi',
    'Occupational Therapy',
    'Nicosia',
    'https://maps.app.goo.gl/djSJi96q8PK6EQvq6'
  ),
  (
    'Lina Efthyvoulou',
    'Psychology',
    'Nicosia',
    'https://maps.app.goo.gl/6PQqu8W5rrXncr667'
  ),
  (
    'Marios Shialos',
    'Psychology',
    'Nicosia',
    'https://maps.app.goo.gl/94eqMtBJAvKid88g9'
  ),
  (
    'Lawrence Kalogreades',
    'Psychotherapy',
    'Limassol',
    'https://maps.app.goo.gl/NPzZhXGqGFLFRtxN8'
  ),
  (
    'Anastasia Burelomova',
    'Psychology',
    'Limassol',
    'https://maps.app.goo.gl/RCwmAeQMJ7GeGkR87'
  ),
  (
    'Marianna Masoura',
    'Occupational Therapy',
    'Limassol',
    'https://maps.app.goo.gl/Y72Nhg5fFRt1ho5q7'
  ),
  (
    'Christos Theofanous',
    'Psychology',
    'Limassol',
    'https://maps.app.goo.gl/KwJMbViVnt499yqB6'
  );
