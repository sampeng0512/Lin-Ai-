BEGIN;

-- 移除各種已知舊簽章，避免 PostgreSQL/PostgREST 因預設參數多載而無法選擇函式。
DROP FUNCTION IF EXISTS public.lin_get_board(uuid);
DROP FUNCTION IF EXISTS public.lin_get_board(uuid, text);
DROP FUNCTION IF EXISTS public.lin_get_board(uuid, text, text);
DROP FUNCTION IF EXISTS public.lin_get_board(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.lin_get_board(text);
DROP FUNCTION IF EXISTS public.lin_get_board(text, text);
DROP FUNCTION IF EXISTS public.lin_get_board(text, text, text);
DROP FUNCTION IF EXISTS public.lin_get_board(text, text, text, text);

-- 單一函式透過可選參數支援一般好友名單與指定動作排行榜。
CREATE FUNCTION public.lin_get_board(
  p_id uuid,
  p_exercise_id text DEFAULT NULL,
  p_action_name text DEFAULT NULL,
  p_period text DEFAULT 'weekly'
)
RETURNS TABLE (
  id uuid,
  code text,
  name text,
  reps integer,
  xp integer,
  streak integer,
  week_reps integer,
  week_key text,
  ex_reps jsonb,
  week_ex_reps jsonb,
  updated_at timestamptz,
  is_me boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action_key text;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'id required';
  END IF;

  IF p_period NOT IN ('weekly', 'total') THEN
    RAISE EXCEPTION 'p_period must be weekly or total';
  END IF;

  -- action_name 或 exercise_id 必須與分動作 JSON 欄位的 key 相同。
  v_action_key := COALESCE(
    NULLIF(pg_catalog.btrim(p_action_name), ''),
    NULLIF(pg_catalog.btrim(p_exercise_id), '')
  );

  RETURN QUERY
  SELECT
    profile.id,
    profile.code,
    profile.name,
    profile.reps,
    profile.xp,
    profile.streak,
    profile.week_reps,
    profile.week_key,
    profile.ex_reps,
    profile.week_ex_reps,
    profile.updated_at,
    (profile.id = p_id) AS is_me
  FROM public.lin_profiles AS profile
  WHERE profile.id = p_id
     OR EXISTS (
       SELECT 1
       FROM public.lin_friendships AS friendship
       WHERE friendship.user_id = p_id
         AND friendship.friend_id = profile.id
     )
  ORDER BY
    CASE
      WHEN v_action_key IS NOT NULL AND p_period = 'weekly'
        THEN CASE
          WHEN (profile.week_ex_reps ->> v_action_key) ~ '^[0-9]+$'
            THEN (profile.week_ex_reps ->> v_action_key)::bigint
          ELSE 0
        END
      ELSE 0
    END DESC,
    CASE
      WHEN v_action_key IS NOT NULL AND p_period = 'total'
        THEN CASE
          WHEN (profile.ex_reps ->> v_action_key) ~ '^[0-9]+$'
            THEN (profile.ex_reps ->> v_action_key)::bigint
          ELSE 0
        END
      ELSE 0
    END DESC,
    profile.xp DESC,
    profile.name ASC
  LIMIT CASE WHEN v_action_key IS NULL THEN 101 ELSE 50 END;
END;
$$;

REVOKE ALL ON FUNCTION public.lin_get_board(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lin_get_board(uuid, text, text, text)
  TO anon, authenticated;

COMMIT;
