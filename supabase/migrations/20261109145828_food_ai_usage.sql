create table if not exists public.lin_food_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);
alter table public.lin_food_ai_usage enable row level security;
revoke all on public.lin_food_ai_usage from anon, authenticated;

create or replace function public.lin_food_ai_take(p_user uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Taipei')::date;
  v_count integer;
begin
  insert into public.lin_food_ai_usage(user_id, day, count)
  values (p_user, v_day, 1)
  on conflict (user_id, day) do update set count = public.lin_food_ai_usage.count + 1
  where public.lin_food_ai_usage.count < p_limit
  returning count into v_count;
  if v_count is null then
    return -1;
  end if;
  return v_count;
end;
$$;

revoke all on function public.lin_food_ai_take(uuid, integer) from public, anon, authenticated;
grant execute on function public.lin_food_ai_take(uuid, integer) to service_role;
