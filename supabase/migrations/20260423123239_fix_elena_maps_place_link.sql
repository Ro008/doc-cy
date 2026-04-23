-- Use Google Maps place URL (business card) for better trust vs plain address pin.
UPDATE public.directory_manual
SET address_maps_link = 'https://www.google.com/maps/place/Dr.+Elena+Ioannou/',
    updated_at = now()
WHERE name = 'Elena Ioannou';