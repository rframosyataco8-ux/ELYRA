import { useEffect, useState } from 'react';
import { CircularGauge } from './CircularGauge';
import { Shield, ShieldCheck, Cpu, HardDrive, Keyboard } from 'lucide-react';

const isDesktop = typeof window !== 'undefined' && !!window.elyra?.isDesktop;

export function SystemPanel() {
  const [stats, setStats] = useState({ cpu: 18, ram: 42, disk: 55, net: 12 });
  const [hostname, setHostname] = useState('');

  useEffect(() => {
    const update = async () => {
      if (isDesktop && window.elyra) {
        try {
          const s = await window.elyra.getSystemStats();
          setStats({
            cpu: Math.round(s.cpu),
            ram: Math.round(s.ram),
            disk: Math.round(s.disk),
            net: Math.round(s.net),
          });
          if (s.hostname) setHostname(s.hostname);
        } catch {
          /* silent */
        }
      } else {
        setStats((prev) => ({
          cpu: Math.min(95, Math.max(8, prev.cpu + (Math.random() - 0.5) * 6)),
          ram: Math.min(90, Math.max(30, prev.ram + (Math.random() - 0.5) * 3)),
          disk: prev.disk,
          net: Math.min(80, Math.max(5, prev.net + (Math.random() - 0.5) * 8)),
        }));
      }
    };

    update();
    const interval = setInterval(update, isDesktop ? 3000 : 2500);
    return () => clearInterval(interval);
  }, []);

  const protections = [
    { label: 'Antivirus', active: true },
    { label: 'Firewall', active: true },
    { label: 'Protección RT', active: true },
  ];

  return (
    <div className="w-[260px] flex-shrink-0 flex flex-col gap-3">
      <div className="hud-glass p-4 animate-slide-up">
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--ely-accent-soft)' }}
          >
            <Cpu className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
          </div>
          <div>
            <h3 className="text-sm font-medium" style={{ color: 'var(--ely-text)' }}>
              Sistema
            </h3>
            {hostname && (
              <p className="text-[11px] truncate max-w-[160px]" style={{ color: 'var(--ely-text-muted)' }}>
                {hostname}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-4">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ely-success)' }} />
          <span className="text-[12px]" style={{ color: 'var(--ely-text-muted)' }}>
            {isDesktop ? 'Telemetría en vivo' : 'Simulación activa'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CircularGauge label="CPU" value={stats.cpu} color="#58a6ff" />
          <CircularGauge label="RAM" value={stats.ram} color="#a78bfa" />
          <CircularGauge label="Disco" value={stats.disk} color="#3fb950" />
          <CircularGauge label="Red" value={stats.net} color="#79b8ff" />
        </div>
      </div>

      <div className="hud-glass p-4 animate-slide-up" style={{ animationDelay: '60ms' }}>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4" style={{ color: 'var(--ely-accent)' }} />
          <h3 className="text-sm font-medium" style={{ color: 'var(--ely-text)' }}>
            Protección
          </h3>
        </div>

        <div className="flex items-center gap-1.5 mb-3">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ely-success)' }} />
          <span className="text-[12px]" style={{ color: 'var(--ely-text-muted)' }}>
            Perímetro seguro
          </span>
        </div>

        <div className="space-y-1.5">
          {protections.map((p) => (
            <div
              key={p.label}
              className="flex items-center justify-between py-2 px-2.5 rounded-xl"
              style={{
                background: 'var(--ely-bg-soft)',
                border: '1px solid var(--ely-border)',
              }}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--ely-accent)' }} />
                <span className="text-[12px]" style={{ color: 'var(--ely-text)' }}>
                  {p.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ely-success)' }} />
                <span className="text-[10px] font-medium" style={{ color: 'var(--ely-success)' }}>
                  ON
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hud-glass p-3.5 animate-slide-up space-y-2" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--ely-text-muted)' }}>
          <Keyboard className="w-3.5 h-3.5" />
          <span>Ctrl+Shift+E · Mostrar / Ocultar</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--ely-text-muted)' }}>
          <HardDrive className="w-3.5 h-3.5" />
          <span>Ctrl+Espacio · Interrumpir voz</span>
        </div>
      </div>
    </div>
  );
}
