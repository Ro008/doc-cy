-- After running doctors_subscription_tier.sql, mark the earliest 100 profiles as founders.
-- Adjust or run Option A in doctors_subscription_tier.sql if you prefer all rows as founder.

UPDATE public.doctors d
SET subscription_tier = 'founder'
FROM (
  SELECT id
  FROM public.doctors
  ORDER BY created_at ASC NULLS LAST, id ASC
  LIMIT 100
) x
WHERE d.id = x.id;

-- Verify:
-- SELECT subscription_tier, COUNT(*) FROM public.doctors GROUP BY 1;
