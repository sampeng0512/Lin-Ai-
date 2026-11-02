-- Keep friend tables private and let existing RPCs access them as postgres.
DO $$
DECLARE
  v_signature text;
  v_function regprocedure;
  v_required boolean;
  v_signatures text[] := ARRAY[
    'public.lin_upsert_profile(uuid,text,integer,integer,integer,integer,text,jsonb,jsonb)',
    'public.lin_get_board(uuid,text,text,text)',
    'public.lin_add_friend(uuid,text)',
    'public.lin_remove_friend(uuid,text)',
    'public.lin_set_avatar(uuid,text,text)',
    'public.lin_get_avatars(text[])'
  ];
BEGIN
  FOREACH v_signature IN ARRAY v_signatures LOOP
    v_required := v_signature IN (
      'public.lin_upsert_profile(uuid,text,integer,integer,integer,integer,text,jsonb,jsonb)',
      'public.lin_get_board(uuid,text,text,text)'
    );
    v_function := pg_catalog.to_regprocedure(v_signature);

    IF v_function IS NULL THEN
      IF v_required THEN
        RAISE EXCEPTION 'Required friend RPC does not exist: %', v_signature;
      END IF;
      CONTINUE;
    END IF;

    EXECUTE pg_catalog.format('ALTER FUNCTION %s OWNER TO postgres', v_function);
    EXECUTE pg_catalog.format('ALTER FUNCTION %s SECURITY DEFINER', v_function);
    EXECUTE pg_catalog.format('ALTER FUNCTION %s SET search_path = %L', v_function, '');
  END LOOP;
END;
$$;
