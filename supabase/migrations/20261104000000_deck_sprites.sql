-- Up to two Pokémon sprites per deck (shared by all its versions; changing them is not a new version),
-- and the sprites each game was saved with, so a deck's old games can keep the sprites they had.
-- Empty means "work them out from the archetype", which is what every row had before this.
alter table public.decks add column if not exists sprites text[] not null default '{}'
  check (cardinality(sprites) <= 2);
alter table public.games add column if not exists my_sprites text[] not null default '{}'
  check (cardinality(my_sprites) <= 2);
