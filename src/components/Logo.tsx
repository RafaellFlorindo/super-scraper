/**
 * Selo da marca: três barras subindo (o "escalando" que a régua de score usa
 * em toda a UI) varridas por um arco dourado terminando num ping — o radar
 * que acha a oferta certa, não só um ícone genérico de app. Mesmo desenho do
 * favicon (src/app/icon.svg): se mudar aqui, muda lá também.
 */
export default function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9a8bff" />
          <stop offset="1" stopColor="#5636c9" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#logo-bg)" />
      <rect x="7" y="20" width="4" height="6" rx="1.6" fill="#fff" fillOpacity="0.55" />
      <rect x="13.5" y="15" width="4" height="11" rx="1.6" fill="#fff" fillOpacity="0.8" />
      <rect x="20" y="9" width="4" height="17" rx="1.6" fill="#fff" />
      <path
        d="M5 24.5Q13.5 11.5 26.5 6.5"
        fill="none"
        stroke="#f5c56a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="26.5" cy="6.5" r="3.4" fill="none" stroke="#f5c56a" strokeOpacity="0.4" strokeWidth="1.4" />
      <circle cx="26.5" cy="6.5" r="1.7" fill="#f5c56a" />
    </svg>
  );
}
