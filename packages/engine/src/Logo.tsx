/** HowItFlows mark: three nodes on one flowing arc, with a packet travelling between them. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <rect width="32" height="32" rx="10" fill="var(--ink)" />
      <path d="M7 23 Q16 -5 25 23" fill="none" stroke="var(--on-ink)" strokeOpacity="0.35" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="7" cy="23" r="3.6" fill="var(--hue-blue)" />
      <circle cx="16" cy="9" r="3.6" fill="var(--hue-amber)" />
      <circle cx="25" cy="23" r="3.6" fill="var(--hue-violet)" />
      <circle cx="11.5" cy="12.5" r="2" fill="var(--hue-coral)" />
    </svg>
  );
}

export function Logo({ href = '/', section }: { href?: string; section?: string }) {
  return (
    <div className="brand">
      <a className="logo" href={href} aria-label="HowItFlows home">
        <LogoMark />
        <span className="logo-word">
          HowIt<b>Flows</b>
        </span>
      </a>
      {section && <span className="crumb">{section}</span>}
    </div>
  );
}
