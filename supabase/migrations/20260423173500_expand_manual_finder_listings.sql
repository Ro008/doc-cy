-- Replace manual directory with expanded curated Dentistry + Dermatology set.
delete from public.directory_manual;

insert into public.directory_manual (
  name,
  specialty,
  district,
  address_maps_link
)
values
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
    'Valentina Oflidou',
    'Dermatology',
    'Limassol',
    'https://maps.app.goo.gl/RDejcWME7Xr6tZtM6'
  ),
  (
    'Georgina Sarika',
    'Dermatology',
    'Limassol',
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
    'Limassol',
    'https://maps.app.goo.gl/FwGDUQnrbQKUMasn8'
  );
