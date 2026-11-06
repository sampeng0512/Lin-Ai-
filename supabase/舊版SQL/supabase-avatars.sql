-- 好友頭像：在 Supabase 的 SQL Editor 執行一次即可。
-- 頭像是一小段文字：表情頭像存 "🐯|3"（表情|顏色編號）；
-- 自訂照片會先在手機上縮成 96×96 的 JPEG，存成 data:image/... 字串（約 3～8 KB）。
-- 已經執行過舊版也沒關係，重新執行整份即可更新。
begin;

create table if not exists public.lin_avatars (
  id text primary key,                 -- 好友功能的私密 id（只有本人知道）
  code text not null unique,           -- 公開的 6 碼好友代碼
  avatar text not null,
  updated_at timestamptz not null default now()
);

alter table public.lin_avatars drop constraint if exists lin_avatars_avatar_check;
alter table public.lin_avatars add constraint lin_avatars_avatar_check check (
  char_length(avatar) between 1 and 32
  or (char_length(avatar) <= 20000 and avatar ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$')
);

alter table public.lin_avatars enable row level security;
revoke all on public.lin_avatars from anon, authenticated, public;

create or replace function public.lin_set_avatar(p_id text, p_code text, p_avatar text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_id is null or char_length(p_id) < 8 then raise exception 'id required'; end if;
  if p_code !~ '^[A-Z0-9]{6}$' then raise exception 'bad code'; end if;
  if p_avatar is null or not (
    char_length(p_avatar) between 1 and 32
    or (char_length(p_avatar) <= 20000 and p_avatar ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$')
  ) then raise exception 'bad avatar'; end if;
  if exists (select 1 from public.lin_avatars a where a.code = p_code and a.id <> p_id) then
    raise exception 'code taken';
  end if;
  insert into public.lin_avatars as a (id, code, avatar)
  values (p_id, p_code, p_avatar)
  on conflict (id) do update set code = excluded.code, avatar = excluded.avatar, updated_at = pg_catalog.now();
end;
$$;

create or replace function public.lin_get_avatars(p_codes text[])
returns table (code text, avatar text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.code, a.avatar
  from public.lin_avatars a
  where a.code = any (p_codes[1:200]);
$$;

revoke all on function public.lin_set_avatar(text, text, text) from public;
revoke all on function public.lin_get_avatars(text[]) from public;
grant execute on function public.lin_set_avatar(text, text, text) to anon, authenticated;
grant execute on function public.lin_get_avatars(text[]) to anon, authenticated;

commit;
