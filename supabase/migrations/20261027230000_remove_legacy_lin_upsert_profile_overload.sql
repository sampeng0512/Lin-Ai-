BEGIN;

-- Keep the single UUID-based function with optional exercise-stat parameters.
-- Older seven-argument overloads can make PostgREST RPC resolution ambiguous.
DROP FUNCTION IF EXISTS public.lin_upsert_profile(
  uuid, text, integer, integer, integer, integer, text
);
DROP FUNCTION IF EXISTS public.lin_upsert_profile(
  text, text, integer, integer, integer, integer, text
);
DROP FUNCTION IF EXISTS public.lin_upsert_profile(
  text, text, integer, integer, integer, integer, text, jsonb, jsonb
);

NOTIFY pgrst, 'reload schema';

COMMIT;
