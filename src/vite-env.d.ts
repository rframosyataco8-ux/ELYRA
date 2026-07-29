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
    totalMemGB?: number;
    freeMemGB?: number;
  }>;
  openApp: (name: string) => Promise<{ ok: boolean; message?: string; result?: string }>;
  openPath: (p: string) => Promise<{ ok: boolean; message?: string }>;
  openUrl: (url: string) => Promise<{ ok: boolean; result?: string }>;
  openFolder: (folder: string) => Promise<{ ok: boolean; message?: string; result?: string }>;
  runCommand: (cmd: string) => Promise<{ ok: boolean; result?: string }>;
  memoryGet: () => Promise<{ notes: any[]; facts: any[]; history: any[] }>;
  memoryAddNote: (note: string) => Promise<{ ok: boolean }>;
  memoryAddFact: (fact: string) => Promise<{ ok: boolean }>;
  memorySaveHistory: (entry: any) => Promise<{ ok: boolean }>;
  memoryClear: () => Promise<{ ok: boolean }>;
  ttsSpeak: (text: string) => Promise<{ ok: boolean; file?: string; error?: string; fallback?: boolean }>;
  ttsStatus: () => Promise<{ edgeTts: boolean | string; voice: string }>;
  agentChat: (message: string, history: { role: string; text: string }[]) => Promise<{ response: string; intelligent?: boolean }>;
  agentConfigGet: () => Promise<{ hasKey: boolean; baseUrl: string; model: string }>;
  agentConfigSet: (partial: { apiKey?: string; baseUrl?: string; model?: string }) => Promise<any>;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  onAutonomousMode: (cb: (value: boolean) => void) => () => void;
  isDesktop: boolean;
}

interface Window {
  elyra?: ElyraAPI;
}
