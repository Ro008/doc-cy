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
  ),
  (
    'Elena Neophytou',
    'Aesthetician/ Cosmetologist',
    'Paphos',
    'https://maps.app.goo.gl/h1y1bw1iF7qE3tyDA'
  ),
  (
    'Antonis Hadjieftychiou',
    'Plastic Surgery',
    'Nicosia',
    'https://maps.app.goo.gl/tT5nT2xNFd8EHTki8'
  ),
  (
    'Phaedon Christofi',
    'Plastic Surgery',
    'Nicosia',
    'https://maps.app.goo.gl/a4GyvxsNNqGDU7Q4A'
  ),
  (
    'Panagiotis Ermogenous',
    'Plastic Surgery',
    'Nicosia',
    'https://maps.app.goo.gl/N2kNqxsJxqXquMZr9'
  ),
  (
    'Demetris Stavrou',
    'Plastic Surgery',
    'Nicosia',
    'https://maps.app.goo.gl/958MDriq5js1PJTz9'
  ),
  (
    'Iakovos Georgiou',
    'Plastic Surgery',
    'Nicosia',
    'https://maps.app.goo.gl/XQGepToybLX6xH2b7'
  ),
  (
    'Stavros Economou',
    'Plastic Surgery',
    'Limassol',
    'https://maps.app.goo.gl/xT9iQDsa9Rx6X1CD7'
  ),
  (
    'Angelos Karatzias',
    'Plastic Surgery',
    'Nicosia',
    'https://maps.app.goo.gl/XbT5sUtJiFBGuZjTA'
  ),
  (
    'Constantinos Michael',
    'Plastic Surgery',
    'Nicosia',
    'https://maps.app.goo.gl/NfWuu41S2QchdtGw6'
  ),
  (
    'Gina Korfiati',
    'Plastic Surgery',
    'Nicosia',
    'https://maps.app.goo.gl/3NZNdYe2nbXQQiaq6'
  ),
  (
    'Petros Pariza',
    'Plastic Surgery',
    'Nicosia',
    'https://maps.app.goo.gl/zAp9hmfnnNaErpg28'
  ),
  (
    'Demetris Stavrou',
    'Plastic Surgery',
    'Limassol',
    'https://maps.app.goo.gl/VjBczcZ7KkKZwSkv8'
  ),
  (
    'Christos Kitsios',
    'Plastic Surgery',
    'Nicosia',
    'https://maps.app.goo.gl/eQiTT55dERa7grHZ8'
  ),
  (
    'Athena Kozyraki',
    'Midwifery',
    'Nicosia',
    'https://maps.app.goo.gl/4UEj3TBBmckt53Cv9'
  ),
  (
    'Eleni Andreou',
    'Midwifery',
    'Nicosia',
    'https://maps.app.goo.gl/ZkupsztGUUNNiwmq9'
  ),
  (
    'Costas Christoforou',
    'Gynecology',
    'Nicosia',
    'https://maps.app.goo.gl/jFEeMh3SPZhLwuxXA'
  ),
  (
    'Andrie Constantinou',
    'Medicine',
    'Limassol',
    'https://maps.app.goo.gl/QCDyes9CDGbgzs38A'
  ),
  (
    'Eva Oikonomou',
    'Midwifery',
    'Nicosia',
    'https://maps.app.goo.gl/hMWin6UyShwVMP2e9'
  ),
  (
    'Niki Agathokleous',
    'Obstetrics/ Gynecology',
    'Nicosia',
    'https://maps.app.goo.gl/68fps27eyT3EEbeq5'
  ),
  (
    'Andreas Matheou',
    'Obstetrics/ Gynecology',
    'Nicosia',
    'https://maps.app.goo.gl/FmDnnbNoFqASgUpm7'
  ),
  (
    'Dimitra Georgiou',
    'Obstetrics/ Gynecology',
    'Nicosia',
    'https://maps.app.goo.gl/kYVviMBYjNmiyt277'
  ),
  (
    'Spyridakis Chrysostomou',
    'Medicine',
    'Paphos',
    'https://maps.app.goo.gl/dwaGVUQp2bg7sDbT8'
  ),
  (
    'Georges Parpas',
    'Obstetrics/ Gynecology',
    'Paphos',
    'https://maps.app.goo.gl/FMjusNbTi6M9Rb2K7'
  ),
  (
    'Anastasis Panaretou',
    'Fetal Medicine',
    'Paphos',
    'https://maps.app.goo.gl/KwEJ1dPi2emWBAxJ6'
  ),
  (
    'Irina Mzavanatze-Stampolidou',
    'Obstetrics/ Gynecology',
    'Nicosia',
    'https://maps.app.goo.gl/XTG4piLhPYVPpAM9A'
  ),
  (
    'Konstantinos Mikellidis',
    'Obstetrics/ Gynecology',
    'Paphos',
    'https://maps.app.goo.gl/QJCGaSnxVDM94KWw5'
  ),
  (
    'Anastasios Tranoulis',
    'Gynecologic Oncology',
    'Nicosia',
    'https://maps.app.goo.gl/wt1Hd9eu3mSvtv868'
  ),
  (
    'Dimitrios Grigoriou',
    'Obstetrics/ Gynecology',
    'Nicosia',
    'https://maps.app.goo.gl/D8qLhojiSP8rcKje6'
  ),
  (
    'Maria Gavrilina',
    'Obstetrics/ Gynecology',
    'Nicosia',
    'https://maps.app.goo.gl/LcJFMjjT6R5XfEja8'
  ),
  (
    'Evangelia Andreou',
    'Obstetrics/ Gynecology',
    'Nicosia',
    'https://maps.app.goo.gl/8FgwFPGdKwn225z78'
  ),
  (
    'Chris Liassides',
    'Obstetrics/ Gynecology',
    'Nicosia',
    'https://maps.app.goo.gl/HF1ERtQThAzKRrps8'
  ),
  (
    'Nikoletta Chatziapostolou',
    'Obstetrics/ Gynecology',
    'Larnaca',
    'https://maps.app.goo.gl/LKySTscsSZV3upNh6'
  ),
  (
    'Vera Politou',
    'Dermatology',
    'Paphos',
    'https://maps.app.goo.gl/qmagUZLsBgrBreXE9'
  ),
  (
    'Christiana Zacharia Sotiriou',
    'Dermatology',
    'Nicosia',
    'https://maps.app.goo.gl/LZu37LETW3TogkGA6'
  ),
  (
    'Elena Thomaidou',
    'Dermatology',
    'Larnaca',
    'https://maps.app.goo.gl/kRtrV8VhiQcmfbEY8'
  ),
  (
    'Eleni Iosifidou',
    'Dermatology',
    'Larnaca',
    'https://maps.app.goo.gl/D492Lmq7R55z6kkJ7'
  ),
  (
    'Andreas Christodoulou',
    'Dermatology',
    'Larnaca',
    'https://maps.app.goo.gl/tRrgzhhDqh9TWEPUA'
  ),
  (
    'Georgia Marangou',
    'Pediatrics',
    'Paphos',
    'https://maps.app.goo.gl/4ixUbAzag2pWywaT9'
  ),
  (
    'Giorgos Naifa',
    'Pediatrics',
    'Paphos',
    'https://maps.app.goo.gl/6zGCuMs7sUAtz1CL6'
  ),
  (
    'Maria Paschalidou',
    'Pediatrics',
    'Paphos',
    'https://maps.app.goo.gl/xrXim3AF5DC93KM9A'
  ),
  (
    'Christos Demetriou',
    'Pediatrics',
    'Paphos',
    'https://maps.app.goo.gl/rYXJ6rXiLxU36UgM8'
  ),
  (
    'George Loizides',
    'Pediatrics',
    'Paphos',
    'https://maps.app.goo.gl/fkoAHpSBKGMJKRK86'
  ),
  (
    'Artemis Polycarpou',
    'Pediatrics',
    'Paphos',
    'https://maps.app.goo.gl/6anTf4FPnXTBeyve7'
  ),
  (
    'Charis Neocleous',
    'Pediatrics',
    'Paphos',
    'https://maps.app.goo.gl/8sZ8uhzaA5yEunoA7'
  ),
  (
    'Renos Petrou',
    'Pediatrics',
    'Limassol',
    'https://maps.app.goo.gl/Wb2LRn98NSPFq2vN6'
  ),
  (
    'Valentina Stavrou',
    'Ophthalmology',
    'Paphos',
    'https://maps.app.goo.gl/T7oWgsj1QUy6hC4c8'
  ),
  (
    'Ionas Miliatos',
    'Ophthalmology',
    'Paphos',
    'https://maps.app.goo.gl/mKibZaTuoKr36zFK8'
  ),
  (
    'Alexandros Georgiou',
    'Ophthalmology',
    'Paphos',
    'https://maps.app.goo.gl/qyiy5DVWCbkGeNzv6'
  ),
  (
    'Charis Antoniou',
    'Ophthalmology',
    'Paphos',
    'https://maps.app.goo.gl/8U9iDxAk4Em2sDpP6'
  ),
  (
    'Nikolas Stavris',
    'Ophthalmology',
    'Paphos',
    'https://maps.app.goo.gl/w1httwyHHqnT9bqo6'
  ),
  (
    'Savvas Hadjiraftis',
    'Ophthalmology',
    'Paphos',
    'https://maps.app.goo.gl/bJzeXPVRBfWhsADJ6'
  ),
  (
    'Panayiotis Christou',
    'Ophthalmology',
    'Paphos',
    'https://maps.app.goo.gl/ytswnWjHq9sKJoyg8'
  ),
  (
    'Alexandra Koumpi',
    'Ophthalmology',
    'Paphos',
    'https://maps.app.goo.gl/TzDvzRZVzgVjUWMm7'
  ),
  (
    'Elias Elia',
    'Ophthalmology',
    'Limassol',
    'https://maps.app.goo.gl/64hbdM1CsF9zbyQ38'
  ),
  (
    'Antonis Glykeriou',
    'Ophthalmology',
    'Nicosia',
    'https://maps.app.goo.gl/LPpTMA7ptkcDpV726'
  ),
  (
    'Maria Phylactou',
    'Ophthalmology',
    'Nicosia',
    'https://maps.app.goo.gl/j3WEHEfeoGMHhoFD9'
  ),
  (
    'Alexandra Papasavva',
    'Nutrition/ Dietetics',
    'Paphos',
    'https://maps.app.goo.gl/w5jmwPj1MsNMj1rR7'
  ),
  (
    'Theofano Pericleous',
    'Nutrition/ Dietetics',
    'Paphos',
    'https://maps.app.goo.gl/dGhXNbgLLg5cocaV8'
  ),
  (
    'Stavroulla Erodotou',
    'Nutrition/ Dietetics',
    'Paphos',
    'https://maps.app.goo.gl/nesJaFxjYPj2GRxk9'
  ),
  (
    'Rafaella Theodorou',
    'Nutrition/ Dietetics',
    'Paphos',
    'https://maps.app.goo.gl/HAmRATCvHtKioEQKA'
  ),
  (
    'Georgia Charpidi',
    'Nutrition/ Dietetics',
    'Paphos',
    'https://maps.app.goo.gl/GoxrGwyraS5M43Y56'
  ),
  (
    'Katerina Loizou',
    'Nutrition/ Dietetics',
    'Limassol',
    'https://maps.app.goo.gl/bBWdwnixSveXhXny7'
  ),
  (
    'Nicole Pileidi',
    'Nutrition/ Dietetics',
    'Limassol',
    'https://maps.app.goo.gl/A2UwAUfhKrqyegP26'
  ),
  (
    'Tina Christoudias',
    'Nutrition/ Dietetics',
    'Limassol',
    'https://maps.app.goo.gl/regHABCaXoyZx7rP7'
  ),
  (
    'Avgoustina Panagiotou',
    'Nutrition/ Dietetics',
    'Larnaca',
    'https://maps.app.goo.gl/Fz7pJ1e5AgUf4Mq68'
  ),
  (
    'Elisavet Paraskeva',
    'Nutrition/ Dietetics',
    'Larnaca',
    'https://maps.app.goo.gl/ivFr3S8ykXWrHKLA7'
  ),
  (
    'Talia Evangelou',
    'Nutrition/ Dietetics',
    'Larnaca',
    'https://maps.app.goo.gl/Ln3BHLga7TVhFB7S9'
  ),
  (
    'Spyros Petrou',
    'Nutrition/ Dietetics',
    'Larnaca',
    'https://maps.app.goo.gl/wGNpLKEV7P4H6r768'
  );
