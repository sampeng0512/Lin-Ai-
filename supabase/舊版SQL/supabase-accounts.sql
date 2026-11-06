begin;

create table if not exists public.fitai_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.fitai_user_data enable row level security;
revoke all on public.fitai_user_data from anon, public;
grant select, insert, update on public.fitai_user_data to authenticated;

drop policy if exists "Users can read their own FitAI data" on public.fitai_user_data;
create policy "Users can read their own FitAI data"
  on public.fitai_user_data for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own FitAI data" on public.fitai_user_data;
create policy "Users can insert their own FitAI data"
  on public.fitai_user_data for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own FitAI data" on public.fitai_user_data;
create policy "Users can update their own FitAI data"
  on public.fitai_user_data for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.fitai_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists fitai_user_data_updated_at on public.fitai_user_data;
create trigger fitai_user_data_updated_at
  before update on public.fitai_user_data
  for each row execute function public.fitai_set_updated_at();

commit;