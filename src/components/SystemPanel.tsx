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
    <div className="w-[272px] flex-shrink-0 flex flex-col gap-3.5">
      <div className="hud-glass rounded-2xl p-4 animate-slide-up corner-brackets">
        <div className="flex items-center gap-2 mb-3.5">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/20 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div>
            <h3 className="text-sm text-sky-100/95 font-medium tracking-wide">Sistema</h3>
            {hostname && (
              <p className="text-[10px] text-sky-500/55 truncate max-w-[160px]">{hostname}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
          <span className="text-[11px] text-emerald-400/90">
            {isDesktop ? 'Telemetría en vivo' : 'Simulación activa'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <CircularGauge label="CPU" value={stats.cpu} color="#38bdf8" />
          <CircularGauge label="RAM" value={stats.ram} color="#a78bfa" />
          <CircularGauge label="Disco" value={stats.disk} color="#34d399" />
          <CircularGauge label="Red" value={stats.net} color="#60a5fa" />
        </div>
      </div>

      <div className="hud-glass rounded-2xl p-4 animate-slide-up" style={{ animationDelay: '80ms' }}>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm text-sky-100/95 font-medium tracking-wide">Protección</h3>
        </div>

        <div className="flex items-center gap-1.5 mb-3.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] text-emerald-400/90">Perímetro seguro</span>
        </div>

        <div className="space-y-2">
          {protections.map((p) => (
            <div
              key={p.label}
              className="flex items-center justify-between py-2 px-2.5 rounded-xl bg-sky-500/5 border border-sky-500/10"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400/75" />
                <span className="text-[12px] text-sky-200/80">{p.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                <span className="text-[10px] text-emerald-400/85 font-medium">ON</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hud-glass rounded-2xl p-3.5 animate-slide-up space-y-2" style={{ animationDelay: '140ms' }}>
        <div className="flex items-center gap-2 text-[11px] text-sky-400/65">
          <Keyboard className="w-3.5 h-3.5" />
          <span>Ctrl+Shift+E · Mostrar / Ocultar</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-sky-400/65">
          <HardDrive className="w-3.5 h-3.5" />
          <span>Ctrl+Espacio · Interrumpir voz</span>
        </div>
      </div>
    </div>
  );
}
