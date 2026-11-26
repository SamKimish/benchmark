-- When a deck was archived (rotated out, or just retired by hand). Set on every version of the deck at once;
-- null = in use. Separate from `active`, which marks the newest version of a list.
alter table public.decks add column if not exists archived_at timestamptz;
