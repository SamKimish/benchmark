# Benchmark

Upload Pokémon TCG Live game logs and see where games are won and lost. A replacement for Training Court,
built around one player's ladder games. Lives at benchmark.kimish.co.uk.

- **Upload**: drop exported battle logs (several at once) or paste them. Each log is parsed in the browser for a
  preview, then again on the server before it is saved. The same game is never saved twice.
- **Match log**: every game with deck, opponent deck, 1st/2nd, result, prizes and loss tags, plus matchup and
  loss-reason tables, filterable by deck and version.
- **Game page**: the parsed summary, the raw log, and fixes for deck, opponent deck, result and notes.
- **Decks**: each version of a list is its own deck, grouped by name.

Stack: Next.js (App Router) on Vercel, Supabase for Postgres and email sign-in.

## The parser

`src/lib/parser` is a TypeScript port of the earlier Python pipeline (`parse.py` + `build.py`). On the 548 games
exported from Training Court it gives the same stats and loss tags for every game. It works out whose log it is
from the opening hand (TCG Live only lists the exporter's), the result from the last line, and both decks'
archetypes from the Pokémon put into play (`archetype.ts`, seeded from the Training Court labels in
`archetypes.ts`). Logs cut off before the end have no result, and the upload form asks for one.

```sh
npm test
```

## Setup

1. Create a Supabase project and run `supabase/migrations/20261023000000_init.sql` in its SQL editor
   (or `supabase db push` with the CLI).
2. In Supabase, Authentication > URL configuration: set the Site URL to `https://benchmark.kimish.co.uk` and add
   `https://benchmark.kimish.co.uk/auth/callback` and `http://localhost:3000/auth/callback` as redirect URLs.
   After signing in for the first time, turn off "Allow new users to sign up" under Authentication > Sign In / Providers.
3. Copy `.env.example` to `.env.local` and fill it in. `ALLOWED_EMAILS` limits who can be sent a sign-in link.
4. `npm install && npm run dev`.

### Deploying

Import the repo in Vercel, add the same environment variables (not the service role key), then add the domain
`benchmark.kimish.co.uk` under the project's Domains and create the `CNAME benchmark -> cname.vercel-dns.com`
record it asks for at your DNS provider.

### Importing Training Court games

Drop a JSON export of Training Court's `logs` rows (an array with `log`, `created_at`, `archetype`,
`opp_archetype`, `result`, `decklist_id`) on the upload page. Games keep Training Court's hand-set result and
opponent deck, and are filed under the decks in `src/lib/training-court-decks.json`, which are created when
missing. `scripts/import-training-court.ts` does the same from the command line with the service role key.
