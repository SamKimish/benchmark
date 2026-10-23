-- Benchmark: decks and the games played with them. Every row belongs to one user (RLS).

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,                 -- 'Straight Dragapult'
  version text not null default '',   -- 'v3'
  version_order int not null default 1,
  archetype text,                     -- Limitless-style slug, 'dragapult' or 'dragapult,dusknoir'
  decklist text not null default '',  -- TCG Live export text
  basics int,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  deck_id uuid references public.decks on delete set null,
  played_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  log text not null,
  log_hash text not null,             -- sha256 of the normalised log, so a game is only saved once
  me text not null,
  opponent text,
  result text check (result in ('W', 'L')),
  went_first boolean,
  my_archetype text,
  opp_archetype text,
  end_reason text,
  tags text[] not null default '{}',
  stats jsonb not null,               -- the parser's full output (src/lib/parser/stats.ts)
  parser_version int not null default 1,
  source text not null default 'upload',  -- 'upload' | 'training-court'
  source_id text,
  notes text not null default '',
  unique (user_id, log_hash)
);

create index games_user_played on public.games (user_id, played_at desc);
create index games_deck on public.games (deck_id);
create index decks_user on public.decks (user_id);

alter table public.decks enable row level security;
alter table public.games enable row level security;

create policy "own decks" on public.decks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own games" on public.games for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
