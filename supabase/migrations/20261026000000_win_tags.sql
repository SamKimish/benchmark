-- Win reasons: what went right in a game, alongside the loss reasons in `tags`
alter table public.games add column if not exists win_tags text[] not null default '{}';
