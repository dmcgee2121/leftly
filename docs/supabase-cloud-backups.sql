-- Leftly cloud backup snapshot table
-- Documentation-only SQL for Supabase setup.
-- Model: one latest snapshot per authenticated user.

create extension if not exists pgcrypto;

create table if not exists public.cloud_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  backup_version text not null default '1',
  backup_json jsonb not null,
  summary_json jsonb,
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cloud_backups_user_id_idx on public.cloud_backups (user_id);

create or replace function public.set_cloud_backups_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cloud_backups_set_updated_at on public.cloud_backups;

create trigger cloud_backups_set_updated_at
before update on public.cloud_backups
for each row
execute function public.set_cloud_backups_updated_at();

alter table public.cloud_backups enable row level security;

drop policy if exists "cloud_backups_select_own" on public.cloud_backups;
create policy "cloud_backups_select_own"
on public.cloud_backups
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "cloud_backups_insert_own" on public.cloud_backups;
create policy "cloud_backups_insert_own"
on public.cloud_backups
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "cloud_backups_update_own" on public.cloud_backups;
create policy "cloud_backups_update_own"
on public.cloud_backups
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Optional future cleanup policy:
-- keep delete disabled for now so the app does not expose a destructive cloud wipe flow.
