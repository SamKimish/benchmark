-- Championship Points earned at an event, for the season total and the race to an Ace Trainer card.
alter table public.tournaments add column cp int check (cp >= 0 and cp < 10000);
