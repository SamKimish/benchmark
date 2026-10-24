/**
 * The loader shown whenever something is loading, saving or importing: a flat Poké Ball (after the GIF Sam
 * picked) that hops twice, spins on the second hop, and throws off a few sparkles.
 */
export default function Pokeball({ size = 48, label }: { size?: number; label?: string }) {
  return (
    <span className="pokeball-wrap" role="status" aria-live="polite">
      <svg className="pokeball" width={size} height={size * 1.25} viewBox="-10 -20 120 145" aria-hidden>
        <ellipse className="pokeball-shadow" cx="50" cy="112" rx="34" ry="5" fill="#4a90f7" />
        <g className="pokeball-sparkles" strokeLinecap="round">
          <circle cx="4" cy="-2" r="3.5" fill="none" stroke="#5ad04a" strokeWidth="2.5" />
          <circle cx="30" cy="-10" r="3.5" fill="none" stroke="#2f6fde" strokeWidth="2.5" />
          <path d="M60 -12v8M56 -8h8" stroke="#f7c600" strokeWidth="3" />
          <path d="M84 -10v8M80 -6h8" stroke="#a34ee0" strokeWidth="3" />
          <circle cx="100" cy="14" r="3" fill="none" stroke="#4a90f7" strokeWidth="2.5" />
        </g>
        <g className="pokeball-ball">
          <path d="M8 52a42 42 0 0 1 84 0z" fill="#de3a35" />
          <path d="M8 52a42 42 0 0 0 84 0z" fill="#e1e8f6" />
          <path d="M22 40a30 30 0 0 1 18-20" stroke="#fff" strokeOpacity=".45" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M58 21l7 2" stroke="#fff" strokeOpacity=".45" strokeWidth="6" strokeLinecap="round" />
          <path d="M16 76A42 42 0 0 1 50 10a42 42 0 0 1 32 70" stroke="#111" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M76 86a42 42 0 0 1-48 3" stroke="#111" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M8 52h4 M20 52h72" stroke="#111" strokeWidth="6" strokeLinecap="round" />
          <g className="pokeball-face">
            <path d="M53 26l-6 10h6l-4 9 9-12h-6l4-7z" fill="#f7c600" />
            <circle cx="50" cy="52" r="10" fill="#e1e8f6" stroke="#111" strokeWidth="6" />
          </g>
        </g>
      </svg>
      {label ? <span className="pokeball-label">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  )
}
