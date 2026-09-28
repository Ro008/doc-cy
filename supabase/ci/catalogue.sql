SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict qylktxw1KrccC0WbAxocFqqDhqBBeHPKpTbqIdQTkTgg0v6IVkpLLrl1zpizhuc

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."app_settings" ("key", "value", "description", "updated_at", "updated_by") VALUES
	('trial_months', '6', 'Free-trial length in whole months (0-24) for each new professional. 0 = no trial.', '2026-09-27 14:26:35.704+00', NULL);


--
-- Data for Name: request_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."request_types" ("name", "requires_approval", "is_edit", "description", "created_at") VALUES
	('professional_registration', true, false, 'A professional''s sign-up as one request: specialties with licence numbers and clinic choices (existing clinics or new-clinic proposals). Approving verifies the professional and writes the approved specialties and clinics.', '2026-09-26 07:32:15.333922+00');


--
-- Data for Name: specialties; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."specialties" ("id", "name", "slug", "created_at") VALUES
	('c90814bd-3c84-46fc-9b51-de85804da1bc', 'Accident & Emergency Medicine', 'accident-emergency-medicine', '2026-09-21 10:44:11.59982+00'),
	('1158a49d-abf6-4efd-b248-cdfb93915240', 'Allergology', 'allergology', '2026-09-21 10:44:11.59982+00'),
	('0fb3d1f7-9329-4c77-a245-0c51d96493f2', 'Anesthesiology', 'anesthesiology', '2026-09-21 10:44:11.59982+00'),
	('57a003f7-e0ad-4b82-8ebd-0578a62fc09d', 'Biochemistry', 'biochemistry', '2026-09-21 10:44:11.59982+00'),
	('c19d0bef-e6e3-44bf-b3a2-45f6c59a6f2b', 'Cardiology', 'cardiology', '2026-09-21 10:44:11.59982+00'),
	('a3fc05ed-9ec7-4ce1-bd2f-19c6b079c920', 'Child & Adolescent Psychiatry', 'child-adolescent-psychiatry', '2026-09-21 10:44:11.59982+00'),
	('0d107968-ad95-459a-abc1-261917aac27a', 'Clinical Dietitian', 'clinical-dietitian', '2026-09-21 10:44:11.59982+00'),
	('834382c8-e554-4471-b709-5f2e229ce3de', 'Clinical Psychologist', 'clinical-psychologist', '2026-09-21 10:44:11.59982+00'),
	('98a4dbd9-d6a9-4944-a407-33ef1bc64c60', 'Cytology', 'cytology', '2026-09-21 10:44:11.59982+00'),
	('cbcc94a4-8b82-4955-bc31-b93b036e47ab', 'Dentist', 'dentist', '2026-09-21 10:44:11.59982+00'),
	('6b224be4-3dce-484b-a71a-60692309a5b1', 'Dentistry', 'dentistry', '2026-09-21 10:44:11.59982+00'),
	('c44ba3b6-f67b-496e-a885-054b091e1eb2', 'Dentoalveolar Surgery', 'dentoalveolar-surgery', '2026-09-21 10:44:11.59982+00'),
	('dd5283cc-6564-46d6-acc9-1450e34d357a', 'Dermato-Venereology', 'dermato-venereology', '2026-09-21 10:44:11.59982+00'),
	('c6bc0c8f-8ed7-4473-9911-39994b6619bd', 'Diagnostic Radiology', 'diagnostic-radiology', '2026-09-21 10:44:11.59982+00'),
	('d4cc4cc0-90b2-4542-a379-35982b3cd077', 'Endocrinology', 'endocrinology', '2026-09-21 10:44:11.59982+00'),
	('fc7211a0-9afb-4362-83a9-b2dd4d29e234', 'Gastroenterology', 'gastroenterology', '2026-09-21 10:44:11.59982+00'),
	('3c07ecb7-9487-41c8-8908-effbfcc428cd', 'General Nurse', 'general-nurse', '2026-09-21 10:44:11.59982+00'),
	('d716e306-a5ef-4627-a0d1-ae785c54a56a', 'General Surgery', 'general-surgery', '2026-09-21 10:44:11.59982+00'),
	('674844cc-80da-4493-b37a-458df6917076', 'Geriatrics', 'geriatrics', '2026-09-21 10:44:11.59982+00'),
	('222e3ac6-6261-43b9-be74-a597a4fbab92', 'Gynecology', 'gynecology', '2026-09-21 10:44:11.59982+00'),
	('feaead48-4f3e-40de-8480-f0b2c11e3258', 'Hematology', 'hematology', '2026-09-21 10:44:11.59982+00'),
	('541f5ad0-9a2b-46f3-ad98-67dd3ff21e14', 'Immunology', 'immunology', '2026-09-21 10:44:11.59982+00'),
	('613a2d8d-87bc-43d6-ac8d-725b47e1802b', 'Infectious Diseases', 'infectious-diseases', '2026-09-21 10:44:11.59982+00'),
	('66fee7de-0c6b-448a-b238-43f0b23acc8d', 'Intensive Care', 'intensive-care', '2026-09-21 10:44:11.59982+00'),
	('94032df7-8151-4bc4-8f14-93ddf815109f', 'Internal Medicine', 'internal-medicine', '2026-09-21 10:44:11.59982+00'),
	('2bcf7a02-7e2d-4e76-9eb1-8683221fca8b', 'Medical Genetic', 'medical-genetic', '2026-09-21 10:44:11.59982+00'),
	('54262644-26c7-4568-861d-de922a9ff983', 'Medical Oncology', 'medical-oncology', '2026-09-21 10:44:11.59982+00'),
	('f214fb2b-580d-4dbe-a759-5bc1c5c4a33e', 'Mental Health Nurse', 'mental-health-nurse', '2026-09-21 10:44:11.59982+00'),
	('0eee73a7-cb7c-4952-a74b-3b3330686604', 'Microbiology', 'microbiology', '2026-09-21 10:44:11.59982+00'),
	('859d11b1-544b-4bb2-91ad-941ec521db5e', 'Midwife', 'midwife', '2026-09-21 10:44:11.59982+00'),
	('110e5bab-280e-4cd6-b009-8c636f6a9b33', 'Neonatology', 'neonatology', '2026-09-21 10:44:11.59982+00'),
	('b7506bd2-38f4-414d-9ea7-31fa4713b64c', 'Neurological Surgery', 'neurological-surgery', '2026-09-21 10:44:11.59982+00'),
	('dec3a200-a416-4215-a6b9-e2c7677b4c1f', 'Neurology', 'neurology', '2026-09-21 10:44:11.59982+00'),
	('660a9bb5-7781-445d-9b95-74f8590b7a60', 'Nuclear Medicine', 'nuclear-medicine', '2026-09-21 10:44:11.59982+00'),
	('781f257a-7600-439e-a594-b645c647d4cb', 'Obstetrics - Gynaecology', 'obstetrics-gynaecology', '2026-09-21 10:44:11.59982+00'),
	('1422415d-343a-41bf-bafd-5c74c7fbe93d', 'Occupational Therapist', 'occupational-therapist', '2026-09-21 10:44:11.59982+00'),
	('635d2793-e109-4f0f-83d7-f347afb7195a', 'Ophthalmology', 'ophthalmology', '2026-09-21 10:44:11.59982+00'),
	('62e83908-1c5a-4c93-918b-9447b8c78614', 'Oral And Maxillo-Facial Surgery', 'oral-and-maxillo-facial-surgery', '2026-09-21 10:44:11.59982+00'),
	('05a35b53-95fe-4767-a7c2-21eadf899ac3', 'Oral Surgery', 'oral-surgery', '2026-09-21 10:44:11.59982+00'),
	('24393954-bdb1-445b-8c68-ee68cf8f261a', 'Orthodontics', 'orthodontics', '2026-09-21 10:44:11.59982+00'),
	('1fb850ea-266c-4492-9c8f-979d551f11c5', 'Orthopaedics', 'orthopaedics', '2026-09-21 10:44:11.59982+00'),
	('7888e37c-7bff-41ca-9d06-0aa9c3ca1ff4', 'Otorhinolaryngology', 'otorhinolaryngology', '2026-09-21 10:44:11.59982+00'),
	('31675835-076f-4629-b825-99b441849c25', 'Paediatric Cardiology', 'paediatric-cardiology', '2026-09-21 10:44:11.59982+00'),
	('ff1c2c3f-219c-4190-ac2b-2ad6a1fbe73f', 'Paediatric Neurology', 'paediatric-neurology', '2026-09-21 10:44:11.59982+00'),
	('6f5e31df-f9ae-459d-a3e0-0acda065a1b9', 'Paediatric Surgery', 'paediatric-surgery', '2026-09-21 10:44:11.59982+00'),
	('a9e2e812-e374-44b8-ad58-4d97f8b54908', 'Paediatrics', 'paediatrics', '2026-09-21 10:44:11.59982+00'),
	('bccd0a82-f57c-4aee-b2d1-9b4272823732', 'Palliative Care Services', 'palliative-care-services', '2026-09-21 10:44:11.59982+00'),
	('5e54f624-30a3-4794-94ba-2a62961ad04b', 'Pathological Anatomy', 'pathological-anatomy', '2026-09-21 10:44:11.59982+00'),
	('09c525c2-3191-4ced-8953-bf68bc6f86f4', 'Personal Doctor', 'personal-doctor', '2026-09-21 10:44:11.59982+00'),
	('4cdc52ec-870b-4a21-a9d9-efae78740170', 'Physical Medicine And Rehabilitation', 'physical-medicine-and-rehabilitation', '2026-09-21 10:44:11.59982+00'),
	('7f18d9d9-edd5-489c-801b-a5ddb0564f98', 'Physiotherapist', 'physiotherapist', '2026-09-21 10:44:11.59982+00'),
	('18010677-8523-4d5a-8d5b-6aee1548d289', 'Plastic Surgery', 'plastic-surgery', '2026-09-21 10:44:11.59982+00'),
	('f5da603c-836c-4e97-b1ca-fca10d1051b9', 'Podiatrist', 'podiatrist', '2026-09-21 10:44:11.59982+00'),
	('88d3c4b1-d43d-4387-9940-222badb84464', 'Psychiatry', 'psychiatry', '2026-09-21 10:44:11.59982+00'),
	('32ad92ba-4ba9-4a8d-87d7-2b31deafa4e9', 'Radiation Oncology', 'radiation-oncology', '2026-09-21 10:44:11.59982+00'),
	('ee11874c-00c9-4a18-9462-e3eb8e9ad9dd', 'Rehabilitation Services', 'rehabilitation-services', '2026-09-21 10:44:11.59982+00'),
	('4cf3b55c-a3f4-4f00-bb9c-e1a89e930451', 'Renal Diseases', 'renal-diseases', '2026-09-21 10:44:11.59982+00'),
	('0f4e24cb-b56b-4fd5-828d-efc19d6f23d2', 'Respiratory Medicine', 'respiratory-medicine', '2026-09-21 10:44:11.59982+00'),
	('1ce3cbc0-4a47-4a17-b3a7-d3d0178ca82d', 'Rheumatology', 'rheumatology', '2026-09-21 10:44:11.59982+00'),
	('62f4cc45-b13f-4036-8dad-a4a240ebccde', 'Speech Therapist', 'speech-therapist', '2026-09-21 10:44:11.59982+00'),
	('a24c0752-f395-441b-9481-2bf4a4634488', 'Thoracic Surgery / Cardio Surgery', 'thoracic-surgery-cardio-surgery', '2026-09-21 10:44:11.59982+00'),
	('0e982660-8ceb-4e16-96bd-9a7e1fc2426b', 'Urology', 'urology', '2026-09-21 10:44:11.59982+00'),
	('8386b15b-078c-43e9-84a6-5ae8cfbddbf4', 'Vascular Surgery', 'vascular-surgery', '2026-09-21 10:44:11.59982+00'),
	('17dd180d-d7fb-4a42-9d4d-23d17721bed7', 'Dermatology', 'dermatology', '2026-09-21 10:50:45.927562+00'),
	('a086c97c-a820-421f-81ec-bf0640e74bad', 'Psychology', 'psychology', '2026-09-21 10:51:12.707284+00'),
	('f3850072-4b66-48e8-a6aa-90ed776f43b2', 'Sexology', 'sexology', '2026-09-21 10:51:12.707284+00'),
	('dfb29d86-b268-4645-98e1-8d47a398d366', 'Pediatrics', 'pediatrics', '2026-09-21 13:44:31.49996+00'),
	('111d21a7-ed7a-42ad-aa39-1fb7021e660b', 'Wellness', 'wellness', '2026-09-21 13:44:35.401707+00'),
	('81a70dfa-562a-4e84-a9d7-ab8e8fe3f6e2', 'General Practice', 'general-practice', '2026-09-21 13:44:53.351266+00'),
	('2605ca15-dfca-4dad-8329-415fc6b4edd3', 'Laser & Medical Aesthetics', 'laser-medical-aesthetics', '2026-09-22 07:24:55.759708+00');


--
-- PostgreSQL database dump complete
--

-- \unrestrict qylktxw1KrccC0WbAxocFqqDhqBBeHPKpTbqIdQTkTgg0v6IVkpLLrl1zpizhuc

RESET ALL;
