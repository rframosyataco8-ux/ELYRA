/// <reference types="vite/client" />

interface ElyraAPI {
  getSystemStats: () => Promise<{
    cpu: number;
    ram: number;
    disk: number;
    net: number;
    platform?: string;
    hostname?: string;
    uptime?: number;
    arch?: string;
    totalMemGB?: number;
    freeMemGB?: number;
  }>;
  openApp: (name: string) => Promise<{ ok: boolean; message?: string }>;
  openPath: (p: string) => Promise<{ ok: boolean; message?: string }>;
  openUrl: (url: string) => Promise<{ ok: boolean; message?: string }>;
  openFolder: (folder: string) => Promise<{ ok: boolean; message?: string }>;
  runCommand: (cmd: string) => Promise<{ ok: boolean; message?: string; stdout?: string; stderr?: string }>;
  memoryGet: () => Promise<{ notes: any[]; facts: any[]; history: any[] }>;
  memoryAddNote: (note: string) => Promise<{ ok: boolean }>;
  memoryAddFact: (fact: string) => Promise<{ ok: boolean }>;
  memorySaveHistory: (entry: any) => Promise<{ ok: boolean }>;
  memoryClear: () => Promise<{ ok: boolean }>;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  onAutonomousMode: (cb: (value: boolean) => void) => () => void;
  isDesktop: boolean;
}

interface Window {
  elyra?: ElyraAPI;
}
