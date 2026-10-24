-- Versions of the same list share a line_id; each save of a changed list adds a row and retires the last.
alter table public.decks add column line_id uuid not null default gen_random_uuid();

update public.decks d set line_id = f.line_id
from (select distinct on (user_id, name) user_id, name, line_id from public.decks order by user_id, name, version_order) f
where d.user_id = f.user_id and d.name = f.name;

create index decks_line on public.decks (line_id);
