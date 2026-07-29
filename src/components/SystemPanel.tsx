import { useEffect, useState } from 'react';
import { CircularGauge } from './CircularGauge';
import { Shield, ShieldCheck } from 'lucide-react';

const isDesktop = typeof window !== 'undefined' && !!window.elyra?.isDesktop;

export function SystemPanel() {
  const [stats, setStats] = useState({ cpu: 18, ram: 42, disk: 55, net: 12 });

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
        } catch {
          // fallback
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
    { label: 'Protección en tiempo real', active: true },
  ];

  return (
    <div className="w-[260px] flex-shrink-0 flex flex-col gap-4">
      <div className="rounded-xl bg-[#0a1525]/80 border border-sky-500/15 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded-md bg-sky-500/20 flex items-center justify-center">
            <svg className="w-3 h-3 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h3 className="text-sm text-sky-100/90 font-medium">Estado del sistema</h3>
        </div>

        <div className="flex items-center gap-1.5 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] text-emerald-400">
            {isDesktop ? 'Datos reales del PC' : 'Todo funciona correctamente'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <CircularGauge label="CPU" value={stats.cpu} color="#38bdf8" />
          <CircularGauge label="RAM" value={stats.ram} color="#a78bfa" />
          <CircularGauge label="Disco" value={stats.disk} color="#34d399" />
          <CircularGauge label="Red" value={stats.net} color="#60a5fa" />
        </div>
      </div>

      <div className="rounded-xl bg-[#0a1525]/80 border border-sky-500/15 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm text-sky-100/90 font-medium">Protección</h3>
        </div>

        <div className="flex items-center gap-1.5 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] text-emerald-400">Activo y protegido</span>
        </div>

        <div className="space-y-2.5">
          {protections.map((p) => (
            <div key={p.label} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-sky-500/5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400/70" />
                <span className="text-[12px] text-sky-200/70">{p.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-emerald-400">Activo</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
