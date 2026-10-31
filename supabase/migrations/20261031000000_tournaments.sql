-- In-person tournaments: the event, the list you played, where you finished, and each round's opponent and games.
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,                       -- 'Gdańsk Regionals'
  kind text not null default 'locals'
    check (kind in ('locals', 'challenge', 'cup', 'regionals', 'special', 'internationals', 'worlds', 'other')),
  format text not null default '',          -- 'Standard', 'TEF–MEG'
  location text not null default '',
  start_date date not null default current_date,
  end_date date,                            -- multi-day events only
  deck_id uuid references public.decks on delete set null,
  my_archetype text,                        -- the deck key; kept even without a saved list
  placement int check (placement > 0),
  players int check (players > 0),
  -- [{ opp: 'dragapult,crushing-hammer', games: 'LWT', special: null | 'bye' | 'id', opponent: '', notes: '' }]
  rounds jsonb not null default '[]',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index tournaments_user_date on public.tournaments (user_id, start_date desc);
create index tournaments_deck on public.tournaments (deck_id);

alter table public.tournaments enable row level security;

create policy "own tournaments" on public.tournaments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
