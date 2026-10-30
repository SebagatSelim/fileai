import { toPercentInt } from '../utils/format';

/** Circular confidence indicator (0–1). Turns amber below the low-confidence threshold. */
export default function ConfidenceRing({ value, threshold = 0.6, size = 64 }) {
  const hasValue = value !== null && value !== undefined;
  const pct = toPercentInt(value);
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const low = hasValue && Number(value) < threshold;
  const color = !hasValue ? '#cbd5e1' : low ? '#f59e0b' : '#10b981';

  return (
    <div
      className="fa-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={hasValue ? `AI confidence ${pct}%` : 'AI confidence not available'}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="fa-ring-label" style={{ color: hasValue ? '#0f172a' : '#94a3b8' }}>
        {hasValue ? `${pct}%` : 'n/a'}
      </span>
    </div>
  );
}
