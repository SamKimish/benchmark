import { pct } from '@/lib/format'

/** A headline number: a count, or a win rate drawn as a bar of wins against losses. */
export default function Stat({ label, value, sub, w, n }: { label: string; value?: string; sub?: string; w?: number; n?: number }) {
  const rate = n ? (w ?? 0) / n : null
  const tone = rate === null ? '' : rate >= 0.55 ? ' good' : rate < 0.45 ? ' bad' : ''
  return (
    <div className={`panel stat${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-n">{value ?? pct(w ?? 0, n ?? 0)}</div>
      {rate !== null && (
        <div className="stat-bar" aria-hidden><span style={{ width: `${Math.round(rate * 100)}%` }} /></div>
      )}
      <div className="stat-sub">{sub ?? `${w}–${(n ?? 0) - (w ?? 0)} · ${n} games`}</div>
    </div>
  )
}
