-- Lin AI 初始資料庫結構：帳號雲端備份、好友排行榜與頭像。

-- 帳號登入後的雲端備份資料。
CREATE TABLE IF NOT EXISTS public.fitai_user_data (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fitai_user_data ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fitai_user_data FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON public.fitai_user_data TO authenticated;

DROP POLICY IF EXISTS "Users can read their own FitAI data" ON public.fitai_user_data;
CREATE POLICY "Users can read their own FitAI data"
  ON public.fitai_user_data FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own FitAI data" ON public.fitai_user_data;
CREATE POLICY "Users can insert their own FitAI data"
  ON public.fitai_user_data FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own FitAI data" ON public.fitai_user_data;
CREATE POLICY "Users can update their own FitAI data"
  ON public.fitai_user_data FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.fitai_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fitai_user_data_updated_at ON public.fitai_user_data;
CREATE TRIGGER fitai_user_data_updated_at
  BEFORE UPDATE ON public.fitai_user_data
  FOR EACH ROW EXECUTE FUNCTION public.fitai_set_updated_at();

-- 好友排行榜使用應用程式產生的 UUID，不依賴 Supabase Auth 使用者。
CREATE TABLE IF NOT EXISTS public.lin_profiles (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  reps integer NOT NULL DEFAULT 0,
  xp integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  week_reps integer NOT NULL DEFAULT 0,
  week_key text NOT NULL DEFAULT '',
  ex_reps jsonb NOT NULL DEFAULT '{}'::jsonb,
  week_ex_reps jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lin_profiles
  ADD COLUMN IF NOT EXISTS ex_reps jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS week_ex_reps jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 先移除舊版文字 ID 函式，避免型態轉換或 PostgREST 多載造成衝突。
DROP FUNCTION IF EXISTS public.lin_upsert_profile(text, text, integer, integer, integer, integer, text);
DROP FUNCTION IF EXISTS public.lin_upsert_profile(text, text, integer, integer, integer, integer, text, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.lin_get_board(text);
DROP FUNCTION IF EXISTS public.lin_get_board(text, text, text, text);
DROP FUNCTION IF EXISTS public.lin_add_friend(text, text);
DROP FUNCTION IF EXISTS public.lin_remove_friend(text, text);
DROP FUNCTION IF EXISTS public.lin_set_avatar(text, text, text);
DROP FUNCTION IF EXISTS public.lin_upsert_profile(uuid, text, integer, integer, integer, integer, text, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.lin_get_board(uuid);
DROP FUNCTION IF EXISTS public.lin_get_board(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.lin_add_friend(uuid, text);
DROP FUNCTION IF EXISTS public.lin_remove_friend(uuid, text);
DROP FUNCTION IF EXISTS public.lin_set_avatar(uuid, text, text);

-- 若舊版表格已存在，先移除好友外鍵再將舊文字 ID 轉為 UUID。
DO $$
DECLARE
  v_constraint record;
BEGIN
  IF pg_catalog.to_regclass('public.lin_friendships') IS NOT NULL THEN
    FOR v_constraint IN
      SELECT c.conname
      FROM pg_catalog.pg_constraint AS c
      WHERE c.conrelid = 'public.lin_friendships'::regclass
        AND c.contype = 'f'
    LOOP
      EXECUTE pg_catalog.format(
        'ALTER TABLE public.lin_friendships DROP CONSTRAINT %I',
        v_constraint.conname
      );
    END LOOP;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lin_profiles'
      AND column_name = 'id'
      AND udt_name <> 'uuid'
  ) THEN
    ALTER TABLE public.lin_profiles
      ALTER COLUMN id TYPE uuid USING id::uuid;
  END IF;
END;
$$;

-- 好友雙向關係；資料表中的使用者 ID 與 lin_profiles.id 同為 UUID。
CREATE TABLE IF NOT EXISTS public.lin_friendships (
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

-- 舊版好友關係欄位若為 text，轉成 UUID 後重新建立外鍵。
DO $$
DECLARE
  v_constraint record;
BEGIN
  FOR v_constraint IN
    SELECT c.conname
    FROM pg_catalog.pg_constraint AS c
    WHERE c.conrelid = 'public.lin_friendships'::regclass
      AND c.contype = 'f'
  LOOP
    EXECUTE pg_catalog.format(
      'ALTER TABLE public.lin_friendships DROP CONSTRAINT %I',
      v_constraint.conname
    );
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lin_friendships'
      AND column_name = 'user_id'
      AND udt_name <> 'uuid'
  ) THEN
    ALTER TABLE public.lin_friendships
      ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lin_friendships'
      AND column_name = 'friend_id'
      AND udt_name <> 'uuid'
  ) THEN
    ALTER TABLE public.lin_friendships
      ALTER COLUMN friend_id TYPE uuid USING friend_id::uuid;
  END IF;

  ALTER TABLE public.lin_friendships
    ADD CONSTRAINT lin_friendships_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.lin_profiles(id) ON DELETE CASCADE,
    ADD CONSTRAINT lin_friendships_friend_id_fkey
      FOREIGN KEY (friend_id) REFERENCES public.lin_profiles(id) ON DELETE CASCADE;
END;
$$;

-- 好友頭像以 UUID 作為使用者識別欄位。
CREATE TABLE IF NOT EXISTS public.lin_avatars (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  avatar text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lin_avatars'
      AND column_name = 'id'
      AND udt_name <> 'uuid'
  ) THEN
    ALTER TABLE public.lin_avatars
      ALTER COLUMN id TYPE uuid USING id::uuid;
  END IF;
END;
$$;

ALTER TABLE public.lin_avatars
  DROP CONSTRAINT IF EXISTS lin_avatars_avatar_check;
ALTER TABLE public.lin_avatars
  ADD CONSTRAINT lin_avatars_avatar_check CHECK (
    char_length(avatar) BETWEEN 1 AND 32
    OR (
      char_length(avatar) <= 20000
      AND avatar ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'
    )
  );

ALTER TABLE public.lin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lin_friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lin_avatars ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lin_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.lin_friendships FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.lin_avatars FROM PUBLIC, anon, authenticated;

-- 驗證並正規化前端傳入的分動作次數 JSON。
CREATE OR REPLACE FUNCTION public.lin_clean_exercise_stats(p_stats jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_key text;
  v_value jsonb;
  v_text text;
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF p_stats IS NULL THEN
    RETURN v_result;
  END IF;

  IF pg_catalog.jsonb_typeof(p_stats) <> 'object' THEN
    RAISE EXCEPTION 'exercise stats must be a JSON object';
  END IF;

  FOR v_key, v_value IN
    SELECT e.key, e.value
    FROM pg_catalog.jsonb_each(p_stats) AS e
  LOOP
    v_text := v_value #>> '{}';

    IF pg_catalog.length(pg_catalog.btrim(v_key)) NOT BETWEEN 1 AND 80
       OR pg_catalog.jsonb_typeof(v_value) <> 'number'
       OR v_text !~ '^(0|[1-9][0-9]{0,9})$' THEN
      RAISE EXCEPTION 'invalid exercise statistic for key %', v_key;
    END IF;

    IF v_text::numeric > 2147483647 THEN
      RAISE EXCEPTION 'exercise statistic is too large for key %', v_key;
    END IF;

    v_result := v_result || pg_catalog.jsonb_build_object(v_key, v_text::integer);
  END LOOP;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.lin_clean_exercise_stats(jsonb)
  FROM PUBLIC, anon, authenticated;

-- 寫入個人等級與運動統計；換週時重設週統計，否則合併各動作計數。
CREATE OR REPLACE FUNCTION public.lin_upsert_profile(
  p_id uuid,
  p_name text,
  p_reps integer,
  p_xp integer,
  p_streak integer,
  p_week integer,
  p_week_key text,
  p_ex_reps jsonb DEFAULT '{}'::jsonb,
  p_week_ex_reps jsonb DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code text;
  v_week_key text;
  v_ex_reps jsonb;
  v_week_ex_reps jsonb;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'id required';
  END IF;

  IF p_name IS NULL OR pg_catalog.length(pg_catalog.btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'name required';
  END IF;

  v_week_key := COALESCE(
    NULLIF(pg_catalog.btrim(p_week_key), ''),
    pg_catalog.to_char(CURRENT_DATE, 'YYYY-MM-DD')
  );
  v_ex_reps := public.lin_clean_exercise_stats(p_ex_reps);
  v_week_ex_reps := public.lin_clean_exercise_stats(p_week_ex_reps);

  SELECT profile.code
    INTO v_code
  FROM public.lin_profiles AS profile
  WHERE profile.id = p_id;

  IF v_code IS NULL THEN
    LOOP
      v_code := pg_catalog.upper(pg_catalog.substr(
        pg_catalog.md5(pg_catalog.random()::text || pg_catalog.clock_timestamp()::text),
        1,
        6
      ));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.lin_profiles AS profile WHERE profile.code = v_code
      );
    END LOOP;
  END IF;

  INSERT INTO public.lin_profiles AS profile (
    id, code, name, reps, xp, streak, week_reps, week_key,
    ex_reps, week_ex_reps, updated_at
  )
  VALUES (
    p_id,
    v_code,
    pg_catalog.left(pg_catalog.btrim(p_name), 12),
    GREATEST(COALESCE(p_reps, 0), 0),
    GREATEST(COALESCE(p_xp, 0), 0),
    GREATEST(COALESCE(p_streak, 0), 0),
    GREATEST(COALESCE(p_week, 0), 0),
    v_week_key,
    v_ex_reps,
    v_week_ex_reps,
    pg_catalog.now()
  )
  ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    reps = EXCLUDED.reps,
    xp = EXCLUDED.xp,
    streak = EXCLUDED.streak,
    week_reps = EXCLUDED.week_reps,
    week_ex_reps = CASE
      WHEN profile.week_key IS DISTINCT FROM EXCLUDED.week_key
        THEN EXCLUDED.week_ex_reps
      ELSE profile.week_ex_reps || EXCLUDED.week_ex_reps
    END,
    week_key = EXCLUDED.week_key,
    ex_reps = profile.ex_reps || EXCLUDED.ex_reps,
    updated_at = pg_catalog.now()
  RETURNING profile.code INTO v_code;

  RETURN v_code;
END;
$$;

-- 回傳自己的好友名單；傳入動作時依本週或累計次數排序。
CREATE OR REPLACE FUNCTION public.lin_get_board(
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

-- 以六碼好友代碼新增雙向好友關係。
CREATE OR REPLACE FUNCTION public.lin_add_friend(p_id uuid, p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_friend_id uuid;
  v_friend_name text;
  v_friend_count integer;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'id required';
  END IF;

  IF p_code IS NULL OR p_code !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'bad code';
  END IF;

  SELECT profile.id, profile.name
    INTO v_friend_id, v_friend_name
  FROM public.lin_profiles AS profile
  WHERE profile.code = p_code;

  IF v_friend_id IS NULL THEN
    RAISE EXCEPTION 'friend not found';
  END IF;

  IF v_friend_id = p_id THEN
    RAISE EXCEPTION 'cannot add yourself';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lin_profiles AS profile WHERE profile.id = p_id
  ) THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_friend_count
  FROM public.lin_friendships AS friendship
  WHERE friendship.user_id = p_id;

  IF v_friend_count >= 100
     AND NOT EXISTS (
       SELECT 1
       FROM public.lin_friendships AS friendship
       WHERE friendship.user_id = p_id
         AND friendship.friend_id = v_friend_id
     ) THEN
    RAISE EXCEPTION 'too many friends';
  END IF;

  INSERT INTO public.lin_friendships (user_id, friend_id)
  VALUES (p_id, v_friend_id), (v_friend_id, p_id)
  ON CONFLICT DO NOTHING;

  RETURN v_friend_name;
END;
$$;

-- 雙向移除好友關係。
CREATE OR REPLACE FUNCTION public.lin_remove_friend(p_id uuid, p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_friend_id uuid;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'id required';
  END IF;

  SELECT profile.id
    INTO v_friend_id
  FROM public.lin_profiles AS profile
  WHERE profile.code = p_code;

  IF v_friend_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.lin_friendships AS friendship
  WHERE (friendship.user_id = p_id AND friendship.friend_id = v_friend_id)
     OR (friendship.user_id = v_friend_id AND friendship.friend_id = p_id);
END;
$$;

-- 好友頭像新增與查詢 RPC。
CREATE OR REPLACE FUNCTION public.lin_set_avatar(p_id uuid, p_code text, p_avatar text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'id required';
  END IF;

  IF p_code IS NULL OR p_code !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'bad code';
  END IF;

  IF p_avatar IS NULL OR NOT (
    char_length(p_avatar) BETWEEN 1 AND 32
    OR (
      char_length(p_avatar) <= 20000
      AND p_avatar ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'
    )
  ) THEN
    RAISE EXCEPTION 'bad avatar';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.lin_profiles AS profile
    WHERE profile.id = p_id
      AND profile.code = p_code
  ) THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  INSERT INTO public.lin_avatars AS avatar_row (id, code, avatar)
  VALUES (p_id, p_code, p_avatar)
  ON CONFLICT (id) DO UPDATE
    SET code = EXCLUDED.code,
        avatar = EXCLUDED.avatar,
        updated_at = pg_catalog.now();
END;
$$;

CREATE OR REPLACE FUNCTION public.lin_get_avatars(p_codes text[])
RETURNS TABLE (code text, avatar text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT avatar_row.code, avatar_row.avatar
  FROM public.lin_avatars AS avatar_row
  WHERE avatar_row.code = ANY (p_codes[1:200]);
$$;

REVOKE ALL ON FUNCTION public.lin_upsert_profile(uuid, text, integer, integer, integer, integer, text, jsonb, jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lin_get_board(uuid, text, text, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lin_add_friend(uuid, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lin_remove_friend(uuid, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lin_set_avatar(uuid, text, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lin_get_avatars(text[])
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.lin_upsert_profile(uuid, text, integer, integer, integer, integer, text, jsonb, jsonb)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lin_get_board(uuid, text, text, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lin_add_friend(uuid, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lin_remove_friend(uuid, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lin_set_avatar(uuid, text, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lin_get_avatars(text[])
  TO anon, authenticated;
