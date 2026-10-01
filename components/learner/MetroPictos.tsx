/**
 * Pictogrammes de la signalétique « ligne de métro », dessinés pour le monde
 * (les icônes génériques lisent mal à ces tailles) : la rame vue de face sur
 * ses rails, et le drapeau du terminus avec son éclat.
 */
export function TrainPicto({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <rect x="9" y="4" width="22" height="25" rx="7" stroke="currentColor" strokeWidth="2.6" />
      <rect x="13" y="9" width="14" height="8" rx="2.5" fill="currentColor" />
      <circle cx="15" cy="23" r="1.9" fill="currentColor" />
      <circle cx="25" cy="23" r="1.9" fill="currentColor" />
      <path d="M14 29l-4 6M26 29l4 6M8.5 33h23" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function TerminusPicto({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} aria-hidden="true">
      <path d="M22 50V10" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M22 11c6-3 10 3 16 0v15c-6 3-10-3-16 0" fill="currentColor" />
      <circle cx="22" cy="50" r="3.4" fill="currentColor" />
      <path d="M8 16l-4-2M7 26H3M10 36l-4 3M46 8l3-3M50 18h4M47 30l4 2" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
