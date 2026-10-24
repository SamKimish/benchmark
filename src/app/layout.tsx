import type { Metadata } from 'next'
import Link from 'next/link'
import { Jost } from 'next/font/google'
import { supabaseServer } from '@/lib/supabase/server'
import SiteNav from '@/components/SiteNav'
import './globals.css'

const jost = Jost({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'BenchMark',
  description: 'Upload Pokémon TCG Live game logs and see where games are won and lost.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { data } = await (await supabaseServer()).auth.getUser()
  return (
    <html lang="en-GB" className={jost.variable}>
      <body>
        <header className={`site-header${data.user ? '' : ' signed-out'}`}>
          <div className="site-bar">
            <Link href="/" className="brand" aria-label="BenchMark home">
              <img src="/header/ball.png" alt="" className="brand-ball" />
              <span className="brand-name">BenchMark</span>
            </Link>
            {data.user && <SiteNav />}
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
