interface ArcReactorProps {
  speaking: boolean;
  listening: boolean;
}

export function ArcReactor({ speaking, listening }: ArcReactorProps) {
  const active = speaking || listening;
  const color = speaking ? '#00d4ff' : listening ? '#ff6b35' : '#00b8e6';

  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {/* Outer rotating ring */}
      <div
        className="absolute inset-0 rounded-full border-2 border-transparent animate-spin-slow"
        style={{
          borderTopColor: color,
          borderRightColor: color,
          opacity: active ? 0.8 : 0.4,
          boxShadow: `0 0 30px ${color}40`,
          transition: 'opacity 0.3s',
        }}
      />

      {/* Middle ring - segments */}
      <div
        className="absolute inset-6 rounded-full border border-transparent animate-spin-reverse"
        style={{
          borderTopColor: color,
          borderBottomColor: color,
          opacity: active ? 0.6 : 0.3,
          transition: 'opacity 0.3s',
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 origin-left h-px"
            style={{
              width: '100%',
              transform: `rotate(${i * 45}deg)`,
              background: `linear-gradient(to right, ${color}40, transparent)`,
            }}
          />
        ))}
      </div>

      {/* Inner pulsing core */}
      <div
        className="relative w-32 h-32 rounded-full flex items-center justify-center animate-glow-pulse"
        style={{
          background: `radial-gradient(circle, ${color}30 0%, transparent 70%)`,
        }}
      >
        <div
          className="w-20 h-20 rounded-full border-2 flex items-center justify-center"
          style={{
            borderColor: color,
            boxShadow: `0 0 20px ${color}, inset 0 0 20px ${color}40`,
            background: `radial-gradient(circle, ${color}15 0%, transparent 80%)`,
          }}
        >
          <div
            className="w-10 h-10 rounded-full"
            style={{
              background: `radial-gradient(circle, ${color} 0%, ${color}80 50%, transparent 100%)`,
              boxShadow: `0 0 15px ${color}`,
            }}
          />
        </div>
      </div>

      {/* Pulse rings when active */}
      {active && (
        <>
          <div
            className="absolute inset-0 rounded-full border-2 animate-pulse-ring"
            style={{ borderColor: color }}
          />
          <div
            className="absolute inset-0 rounded-full border-2 animate-pulse-ring"
            style={{ borderColor: color, animationDelay: '1s' }}
          />
        </>
      )}

      {/* Status text */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span
          className="font-display text-xs tracking-[0.3em] uppercase text-glow"
          style={{ color }}
        >
          {speaking ? 'Hablando' : listening ? 'Escuchando' : 'En Espera'}
        </span>
      </div>
    </div>
  );
}
