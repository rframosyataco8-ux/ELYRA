/// <reference types="vite/client" />

interface ProductWindowOpts {
  name: string;
  category?: string;
  views?: string;
  view?: string;
}

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
  ttsSpeak: (text: string) => Promise<{ ok: boolean; dataUrl?: string; error?: string; fallback?: boolean }>;
  ttsStatus: () => Promise<{ edgeTts: boolean | string; voice: string }>;
  sttTranscribe: (payload: { base64: string; mimeType: string }) => Promise<{ ok: boolean; text?: string; error?: string }>;
  sttListenPython: (seconds?: number) => Promise<{ ok: boolean; text?: string; error?: string }>;
  pcVolume: (action: string, value?: number | string) => Promise<{ ok: boolean; result?: string }>;
  pcMedia: (action: string) => Promise<{ ok: boolean; result?: string }>;
  pcBrightness: (action: string, value?: number | string) => Promise<{ ok: boolean; result?: string }>;
  pcClipboard: (action: string, text?: string) => Promise<{ ok: boolean; result?: string }>;
  pcScreenshot: () => Promise<{ ok: boolean; result?: string }>;
  pcListProcesses: () => Promise<{ ok: boolean; result?: string }>;
  pcKillProcess: (name: string) => Promise<{ ok: boolean; result?: string }>;
  pcWindows: (action: string) => Promise<{ ok: boolean; result?: string }>;
  pcInput: (action: string, payload?: { text?: string }) => Promise<{ ok: boolean; result?: string }>;
  agentChat: (message: string, history: { role: string; text: string }[]) => Promise<{ response: string; intelligent?: boolean }>;
  agentConfigGet: () => Promise<{ hasKey: boolean; baseUrl: string; model: string; provider?: string }>;
  agentConfigSet: (partial: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    provider?: string;
  }) => Promise<{ hasKey: boolean; baseUrl: string; model: string; provider?: string }>;
  agentConfigTest: (partial?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  }) => Promise<{
    ok: boolean;
    message: string;
    error?: string;
    detail?: string;
    model?: string;
    baseUrl?: string;
    sample?: string;
  }>;
  /** 1.4 / 1.6 visión */
  pickAndAnalyzeImage: (prompt?: string) => Promise<{ ok: boolean; result?: string; path?: string; via?: string }>;
  analyzeImagePath: (filePath: string, prompt?: string) => Promise<{ ok: boolean; result?: string; path?: string; via?: string }>;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  openProductWindow: (opts: string | ProductWindowOpts) => Promise<{ ok: boolean }>;
  closeProductWindow: () => Promise<{ ok: boolean }>;
  onDeskMode?: (cb: (on: boolean) => void) => () => void;
  showFloatingCore: () => Promise<{ ok: boolean }>;
  hideFloatingCore: () => Promise<{ ok: boolean }>;
  floatingCoreState: (state: { speaking?: boolean; listening?: boolean }) => Promise<{ ok: boolean }>;
  setGlassMode: (enabled: boolean) => Promise<{ ok: boolean; glass?: boolean }>;
  onAutonomousMode: (cb: (value: boolean) => void) => () => void;
  onBargeIn: (cb: () => void) => () => void;
  isDesktop: boolean;
}

interface Window {
  elyra?: ElyraAPI;
}
