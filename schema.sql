-- Run once in Supabase Dashboard -> SQL Editor.
create table if not exists public.players (
  player_key text primary key,
  username text not null,
  gamemode text not null,
  region text not null default '',
  tier text not null check (tier in ('HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5')),
  points integer not null check (points in (40,35,30,25,20,15,10,5,3,2)),
  tester text not null default '',
  discord_message_id text not null default '',
  discord_channel_id text not null default '',
  updated_at timestamptz not null default now()
);
create index if not exists players_points_rank_idx on public.players (points desc, username asc, gamemode asc);
-- The service-role key is used only by the private Node backend and bypasses RLS.
-- Do not expose it in website JavaScript or commit actual credentials.
alter table public.players enable row level security;
