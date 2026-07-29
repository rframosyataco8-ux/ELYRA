import { useEffect, useRef } from 'react';

interface Bar {
  height: number;
  target: number;
}

interface AudioVisualizerProps {
  active: boolean;
  bars?: number;
}

export function AudioVisualizer({ active, bars = 24 }: AudioVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<Bar[]>(Array.from({ length: bars }, () => ({ height: 5, target: 5 })));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const animate = () => {
      const els = containerRef.current?.children;
      const data = barsRef.current;

      for (let i = 0; i < data.length; i++) {
        if (active) {
          if (Math.abs(data[i].height - data[i].target) < 2) {
            data[i].target = Math.random() * 40 + 5;
          }
        } else {
          data[i].target = 5;
        }
        data[i].height += (data[i].target - data[i].height) * 0.15;
        if (els && els[i]) {
          (els[i] as HTMLElement).style.height = `${data[i].height}px`;
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return (
    <div ref={containerRef} className="flex items-end justify-center gap-1 h-12">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-gradient-to-t from-jarvis-500/40 to-jarvis-glow"
          style={{ height: '5px', transition: 'none' }}
        />
      ))}
    </div>
  );
}
