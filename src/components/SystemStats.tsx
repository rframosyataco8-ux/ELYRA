import { useEffect, useState } from 'react';
import { Cpu, HardDrive, Wifi, Clock } from 'lucide-react';

export function SystemStats() {
  const [time, setTime] = useState(new Date());
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setTime(new Date());
      setUptime(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  const stats = [
    { icon: Cpu, label: 'CPU', value: '12%', color: 'text-jarvis-300' },
    { icon: HardDrive, label: 'MEM', value: '64%', color: 'text-jarvis-300' },
    { icon: Wifi, label: 'RED', value: 'ONLINE', color: 'text-green-400' },
    { icon: Clock, label: 'UPTIME', value: formatUptime(uptime), color: 'text-jarvis-300' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded bg-dark-700/50 border border-jarvis-500/15">
          <s.icon className={`w-4 h-4 ${s.color}`} />
          <div className="flex flex-col">
            <span className="text-[9px] text-jarvis-500/50 uppercase tracking-widest">{s.label}</span>
            <span className="text-xs text-jarvis-100 font-mono">{s.value}</span>
          </div>
        </div>
      ))}
      <div className="col-span-2 flex items-center justify-between px-3 py-2 rounded bg-dark-700/50 border border-jarvis-500/15">
        <span className="text-[9px] text-jarvis-500/50 uppercase tracking-widest">Hora</span>
        <span className="text-xs text-jarvis-glow font-mono text-glow">
          {time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
