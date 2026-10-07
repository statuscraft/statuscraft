import type { Mood } from '@statuscraft/core';

const MOUTHS: Record<Mood, React.ReactNode> = {
  happy: <path d="M46 70 Q60 86 74 70 Z" fill="#8C2A1B" stroke="#2B2420" strokeWidth="3" strokeLinejoin="round" />,
  content: <path d="M49 72 Q60 81 71 72" fill="none" stroke="#2B2420" strokeWidth="4" strokeLinecap="round" />,
  uneasy: <path d="M50 75 L70 75" fill="none" stroke="#2B2420" strokeWidth="4" strokeLinecap="round" />,
  worried: <path d="M49 78 Q60 70 71 78" fill="none" stroke="#2B2420" strokeWidth="4" strokeLinecap="round" />,
  panic: <ellipse cx="60" cy="76" rx="7" ry="9" fill="#8C2A1B" stroke="#2B2420" strokeWidth="3" />,
};

export function Pip({
  mood = 'happy',
  size = 48,
  color = '#FDD835',
  className,
  title = 'Pip',
}: {
  mood?: Mood;
  size?: number;
  color?: string;
  className?: string;
  title?: string;
}) {
  const worried = mood === 'worried' || mood === 'panic';
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} role="img" aria-label={title}>
      <title>{title}</title>
      <rect x="28" y="94" width="22" height="12" rx="5" fill="#2B2420" opacity="0.85" />
      <rect x="70" y="94" width="22" height="12" rx="5" fill="#2B2420" opacity="0.85" />
      {[30, 66].map((x) => (
        <g key={x}>
          <rect x={x} y="12" width="24" height="16" rx="5" fill={color} stroke="#2B2420" strokeWidth="3" />
          <rect x={x + 4} y="15" width="16" height="4" rx="2" fill="#fff" opacity="0.45" />
        </g>
      ))}
      <rect x="12" y="24" width="96" height="76" rx="16" fill={color} stroke="#2B2420" strokeWidth="3.5" />
      <rect x="14" y="80" width="92" height="18" rx="12" fill="#000" opacity="0.1" />
      <rect x="20" y="30" width="40" height="6" rx="3" fill="#fff" opacity="0.4" />
      {[44, 76].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="54" rx="11" ry={mood === 'panic' ? 13 : 12} fill="#fff" stroke="#2B2420" strokeWidth="3" />
          <circle cx={x + (worried ? 0 : 2)} cy={worried ? 52 : 56} r={mood === 'panic' ? 4 : 6} fill="#2B2420" />
          <circle cx={x + 4} cy="52" r="2" fill="#fff" />
        </g>
      ))}
      {worried && (
        <g stroke="#2B2420" strokeWidth="3.5" strokeLinecap="round">
          <path d="M33 38 L53 42" />
          <path d="M87 38 L67 42" />
        </g>
      )}
      <ellipse cx="28" cy="70" rx="6" ry="4" fill="#F06292" opacity={mood === 'happy' || mood === 'content' ? 0.55 : 0.2} />
      <ellipse cx="92" cy="70" rx="6" ry="4" fill="#F06292" opacity={mood === 'happy' || mood === 'content' ? 0.55 : 0.2} />
      {MOUTHS[mood]}
      {mood === 'panic' && <path d="M100 30 q4 8 0 12 q-4 -4 0 -12" fill="#4FC3F7" stroke="#2B2420" strokeWidth="2" />}
    </svg>
  );
}

export function PipSays({ children, mood = 'happy', size = 64 }: { children: React.ReactNode; mood?: Mood; size?: number }) {
  return (
    <div className="flex items-end gap-3">
      <Pip mood={mood} size={size} className="shrink-0 animate-hop" />
      <div className="relative mb-4 rounded-2xl border-[3px] border-ink-800 bg-white px-4 py-3 text-ink-800 shadow-chunky">
        <span className="absolute -left-[11px] bottom-3 h-4 w-4 rotate-45 border-b-[3px] border-l-[3px] border-ink-800 bg-white" />
        {children}
      </div>
    </div>
  );
}
