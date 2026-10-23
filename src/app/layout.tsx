import type { Metadata } from 'next'
import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import './globals.css'

export const metadata: Metadata = {
  title: 'Benchmark',
  description: 'Upload Pokémon TCG Live game logs and see where games are won and lost.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { data } = await (await supabaseServer()).auth.getUser()
  return (
    <html lang="en-GB">
      <body>
        <header className="top">
          <Link href="/" className="brand">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M2 12h7m6 0h7" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
            Benchmark
          </Link>
          {data.user && (
            <nav>
              <Link href="/">Match log</Link>
              <Link href="/upload">Upload</Link>
              <Link href="/decks">Decks</Link>
              <form action="/auth/signout" method="post"><button className="link">Sign out</button></form>
            </nav>
          )}
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
