'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/', label: 'Matches', art: 'matches', match: (p: string) => p === '/' || p.startsWith('/games') || p.startsWith('/upload') },
  { href: '/decks', label: 'Decks', art: 'decks', match: (p: string) => p.startsWith('/decks') },
  { href: '/settings', label: 'Settings', art: 'settings', match: (p: string) => p.startsWith('/settings') },
]

function Art({ name }: { name: string }) {
  return <img className="nav-art" src={`/header/${name}.png`} alt="" />
}

/** The illustrated nav: each item's artwork sits on the red line with its label underneath. */
export default function SiteNav() {
  const path = usePathname()
  return (
    <nav className="site-nav" aria-label="Main">
      {ITEMS.map((it) => (
        <Link key={it.href} href={it.href} className={`nav-item nav-${it.art}${it.match(path) ? ' active' : ''}`}
          aria-current={it.match(path) ? 'page' : undefined}>
          <Art name={it.art} />
          <span className="nav-label">{it.label}</span>
        </Link>
      ))}
      <form action="/auth/signout" method="post" className="nav-item nav-logout">
        <button>
          <Art name="logout" />
          <span className="nav-label">Log out</span>
        </button>
      </form>
    </nav>
  )
}
