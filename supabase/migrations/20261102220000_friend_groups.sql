-- Friend groups share the existing public profile stats without exposing the tables.
CREATE TABLE IF NOT EXISTS public.lin_groups (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  name text NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(name)) BETWEEN 1 AND 30),
  invite_code text NOT NULL UNIQUE CHECK (invite_code ~ '^[A-Z0-9]{6}$'),
  created_by uuid NOT NULL REFERENCES public.lin_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE IF NOT EXISTS public.lin_group_members (
  group_id uuid NOT NULL REFERENCES public.lin_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.lin_profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS lin_group_members_user_idx
  ON public.lin_group_members (user_id, joined_at);

ALTER TABLE public.lin_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lin_group_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lin_groups, public.lin_group_members FROM PUBLIC, anon, authenticated;

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

  RETURN pg_catalog.jsonb_build_object(
    'id', v_group_id, 'name', v_name, 'code', v_code, 'created_by', p_id
  );
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

  RETURN pg_catalog.jsonb_build_object(
    'id', v_group.id, 'name', v_group.name, 'code', v_group.invite_code,
    'created_by', v_group.created_by
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lin_get_groups(p_id uuid)
RETURNS TABLE (
  group_id uuid,
  name text,
  invite_code text,
  created_by uuid,
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
  SELECT group_row.id, group_row.name, group_row.invite_code, group_row.created_by,
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

CREATE OR REPLACE FUNCTION public.lin_get_group_board(p_id uuid, p_group_id uuid)
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
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.lin_group_members AS member
    WHERE member.group_id = p_group_id AND member.user_id = p_id
  ) THEN
    RAISE EXCEPTION 'group membership required';
  END IF;

  RETURN QUERY
  SELECT profile.id, profile.code, profile.name, profile.reps, profile.xp,
    profile.streak, profile.week_reps, profile.week_key, profile.ex_reps,
    profile.week_ex_reps, profile.updated_at, profile.id = p_id
  FROM public.lin_group_members AS member
  JOIN public.lin_profiles AS profile ON profile.id = member.user_id
  WHERE member.group_id = p_group_id
  ORDER BY profile.xp DESC, profile.name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.lin_leave_group(p_id uuid, p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid;
  v_next_owner uuid;
BEGIN
  SELECT group_row.created_by INTO v_owner
  FROM public.lin_groups AS group_row
  WHERE group_row.id = p_group_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'group not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lin_group_members AS member
    WHERE member.group_id = p_group_id AND member.user_id = p_id
  ) THEN
    RAISE EXCEPTION 'group membership required';
  END IF;

  IF v_owner = p_id THEN
    SELECT member.user_id INTO v_next_owner
    FROM public.lin_group_members AS member
    WHERE member.group_id = p_group_id AND member.user_id <> p_id
    ORDER BY member.joined_at, member.user_id
    LIMIT 1;
    IF v_next_owner IS NULL THEN
      DELETE FROM public.lin_groups AS group_row WHERE group_row.id = p_group_id;
      RETURN;
    END IF;
    UPDATE public.lin_groups AS group_row
    SET created_by = v_next_owner
    WHERE group_row.id = p_group_id;
  END IF;

  DELETE FROM public.lin_group_members AS member
  WHERE member.group_id = p_group_id AND member.user_id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.lin_create_group(uuid, text),
  public.lin_join_group(uuid, text),
  public.lin_get_groups(uuid),
  public.lin_get_group_board(uuid, uuid),
  public.lin_leave_group(uuid, uuid)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lin_create_group(uuid, text),
  public.lin_join_group(uuid, text),
  public.lin_get_groups(uuid),
  public.lin_get_group_board(uuid, uuid),
  public.lin_leave_group(uuid, uuid)
TO anon, authenticated;

ALTER FUNCTION public.lin_create_group(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.lin_join_group(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.lin_get_groups(uuid) OWNER TO postgres;
ALTER FUNCTION public.lin_get_group_board(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.lin_leave_group(uuid, uuid) OWNER TO postgres;
