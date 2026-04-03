-- Run this in Supabase SQL Editor to persist online status across backend restarts.
create table if not exists public.user_presence (
  user_id uuid primary key references public.users(id) on delete cascade,
  is_online boolean not null default false,
  active_since timestamptz null,
  last_seen_at timestamptz null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_presence_is_online on public.user_presence(is_online);
