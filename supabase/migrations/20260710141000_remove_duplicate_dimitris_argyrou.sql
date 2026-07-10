-- Remove duplicate manual listing for Dimitris Argyrou (same clinic, two Google Place IDs).

delete from public.directory_manual
where address_maps_link = 'https://maps.google.com/?cid=15052820630080588523&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA';
