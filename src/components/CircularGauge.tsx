interface CircularGaugeProps {
  label: string;
  value: number;
  color: string;
  size?: number;
}

export function CircularGauge({ label, value, color, size = 72 }: CircularGaugeProps) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--ely-track)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.2, 0, 0, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-sm font-semibold tabular-nums"
            style={{ color: 'var(--ely-text)' }}
          >
            {Math.round(value)}%
          </span>
        </div>
      </div>
      <span className="text-[11px] font-medium" style={{ color: 'var(--ely-text-muted)' }}>
        {label}
      </span>
    </div>
  );
}
