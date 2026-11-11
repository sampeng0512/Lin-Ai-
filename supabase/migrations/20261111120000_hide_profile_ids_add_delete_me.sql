-- 好友與群組函式不再回傳任何人的內部 UUID。
-- 這些 UUID 是 lin_* 函式用來辨識身分的憑證，外流後別人就能冒充他人改名、改分數、刪好友。
-- 另外把 lin_delete_me 收進 repo，並改成自己建立的群組會先交接給下一位成員（舊版會把整個群組一起刪掉）。
-- lin_avatars.id 在線上資料庫是 text、在 initial_schema 是 uuid，所以比對時兩邊都轉成 text。
BEGIN;

DROP FUNCTION IF EXISTS public.lin_get_board(uuid, text, text, text);

CREATE FUNCTION public.lin_get_board(
  p_id uuid,
  p_exercise_id text DEFAULT NULL,
  p_action_name text DEFAULT NULL,
  p_period text DEFAULT 'weekly'
)
RETURNS TABLE (
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

DROP FUNCTION IF EXISTS public.lin_get_group_board(uuid, uuid);

CREATE FUNCTION public.lin_get_group_board(p_id uuid, p_group_id uuid)
RETURNS TABLE (
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
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.lin_group_members AS member
    WHERE member.group_id = p_group_id AND member.user_id = p_id
  ) THEN
    RAISE EXCEPTION 'group membership required';
  END IF;

  RETURN QUERY
  SELECT profile.code, profile.name, profile.reps, profile.xp,
    profile.streak, profile.week_reps, profile.week_key, profile.ex_reps,
    profile.week_ex_reps, profile.updated_at, profile.id = p_id
  FROM public.lin_group_members AS member
  JOIN public.lin_profiles AS profile ON profile.id = member.user_id
  WHERE member.group_id = p_group_id
  ORDER BY profile.xp DESC, profile.name ASC;
END;
$$;

DROP FUNCTION IF EXISTS public.lin_get_groups(uuid);

CREATE FUNCTION public.lin_get_groups(p_id uuid)
RETURNS TABLE (
  group_id uuid,
  name text,
  invite_code text,
  created_at timestamptz,
  member_count bigint,
  is_owner boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT group_row.id, group_row.name, group_row.invite_code,
    group_row.created_at,
    (SELECT pg_catalog.count(*) FROM public.lin_group_members AS members
      WHERE members.group_id = group_row.id),
    group_row.created_by = p_id
  FROM public.lin_groups AS group_row
  JOIN public.lin_group_members AS mine ON mine.group_id = group_row.id
  WHERE mine.user_id = p_id
  ORDER BY group_row.created_at, group_row.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.lin_create_group(p_id uuid, p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text := pg_catalog.left(pg_catalog.btrim(p_name), 30);
  v_code text;
  v_group_id uuid := pg_catalog.gen_random_uuid();
BEGIN
  IF p_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.lin_profiles AS profile WHERE profile.id = p_id
  ) THEN
    RAISE EXCEPTION 'profile required';
  END IF;
  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'group name required';
  END IF;

  LOOP
    v_code := pg_catalog.upper(pg_catalog.substr(
      pg_catalog.md5(pg_catalog.random()::text || pg_catalog.clock_timestamp()::text),
      1, 6
    ));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.lin_groups AS group_row WHERE group_row.invite_code = v_code
    );
  END LOOP;

  INSERT INTO public.lin_groups (id, name, invite_code, created_by)
  VALUES (v_group_id, v_name, v_code, p_id);
  INSERT INTO public.lin_group_members (group_id, user_id)
  VALUES (v_group_id, p_id);

  RETURN pg_catalog.jsonb_build_object('id', v_group_id, 'name', v_name, 'code', v_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.lin_join_group(p_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_group public.lin_groups%ROWTYPE;
  v_member_count integer;
BEGIN
  IF p_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.lin_profiles AS profile WHERE profile.id = p_id
  ) THEN
    RAISE EXCEPTION 'profile required';
  END IF;
  IF p_code IS NULL OR p_code !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'bad group code';
  END IF;

  SELECT group_row.* INTO v_group
  FROM public.lin_groups AS group_row
  WHERE group_row.invite_code = p_code;
  IF v_group.id IS NULL THEN
    RAISE EXCEPTION 'group not found';
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_member_count
  FROM public.lin_group_members AS member
  WHERE member.group_id = v_group.id;
  IF v_member_count >= 100 AND NOT EXISTS (
    SELECT 1 FROM public.lin_group_members AS member
    WHERE member.group_id = v_group.id AND member.user_id = p_id
  ) THEN
    RAISE EXCEPTION 'group is full';
  END IF;

  INSERT INTO public.lin_group_members (group_id, user_id)
  VALUES (v_group.id, p_id)
  ON CONFLICT DO NOTHING;

  RETURN pg_catalog.jsonb_build_object('id', v_group.id, 'name', v_group.name, 'code', v_group.invite_code);
END;
$$;

-- 刪除自己的好友資料：自己建立的群組先交給下一位成員（沒人就刪掉群組），
-- 再刪頭像與個人資料；好友關係與群組成員資格會跟著外鍵一起刪除。
CREATE OR REPLACE FUNCTION public.lin_delete_me(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_group uuid;
  v_next_owner uuid;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'id required';
  END IF;

  FOR v_group IN
    SELECT group_row.id FROM public.lin_groups AS group_row WHERE group_row.created_by = p_id
  LOOP
    SELECT member.user_id INTO v_next_owner
    FROM public.lin_group_members AS member
    WHERE member.group_id = v_group AND member.user_id <> p_id
    ORDER BY member.joined_at, member.user_id
    LIMIT 1;
    IF v_next_owner IS NULL THEN
      DELETE FROM public.lin_groups AS group_row WHERE group_row.id = v_group;
    ELSE
      UPDATE public.lin_groups AS group_row SET created_by = v_next_owner WHERE group_row.id = v_group;
    END IF;
  END LOOP;

  DELETE FROM public.lin_avatars AS avatar_row WHERE avatar_row.id::text = p_id::text;
  DELETE FROM public.lin_profiles AS profile WHERE profile.id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.lin_get_board(uuid, text, text, text),
  public.lin_get_group_board(uuid, uuid),
  public.lin_get_groups(uuid),
  public.lin_create_group(uuid, text),
  public.lin_join_group(uuid, text),
  public.lin_delete_me(uuid)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lin_get_board(uuid, text, text, text),
  public.lin_get_group_board(uuid, uuid),
  public.lin_get_groups(uuid),
  public.lin_create_group(uuid, text),
  public.lin_join_group(uuid, text),
  public.lin_delete_me(uuid)
TO anon, authenticated;

ALTER FUNCTION public.lin_get_board(uuid, text, text, text) OWNER TO postgres;
ALTER FUNCTION public.lin_get_group_board(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.lin_get_groups(uuid) OWNER TO postgres;
ALTER FUNCTION public.lin_create_group(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.lin_join_group(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.lin_delete_me(uuid) OWNER TO postgres;

NOTIFY pgrst, 'reload schema';

COMMIT;
