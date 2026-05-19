create table if not exists public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fcm_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  app_version text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_devices_user_enabled_idx
  on public.notification_devices (user_id, enabled);

alter table public.notification_devices enable row level security;

create policy "Users can read own notification devices"
on public.notification_devices for select to authenticated
using (auth.uid() = user_id);

create policy "Users can register own notification devices"
on public.notification_devices for insert to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own notification devices"
on public.notification_devices for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own notification devices"
on public.notification_devices for delete to authenticated
using (auth.uid() = user_id);

create or replace function public.set_notification_devices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_notification_devices_updated_at
on public.notification_devices;

create trigger set_notification_devices_updated_at
before update on public.notification_devices
for each row
execute function public.set_notification_devices_updated_at();
