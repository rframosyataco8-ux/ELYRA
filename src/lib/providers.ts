/** Detección automática de proveedores de IA a partir de la API key */

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

/** Modelo por defecto NVIDIA: equilibrado calidad/velocidad en la nube */
export const NVIDIA_DEFAULT_MODEL = 'nvidia/llama-3.1-nemotron-70b-instruct';

export type ProviderId =
  | 'groq'
  | 'gemini'
  | 'nvidia'
  | 'anthropic'
  | 'openai'
  | 'xai'
  | 'openrouter'
  | 'ollama';

export type ProviderPreset = {
  label: string;
  url: string;
  model: string;
  id: ProviderId;
};

export type NvidiaModelOption = {
  id: string;
  label: string;
  tier: 'ultra' | 'pro' | 'fast' | 'code' | 'vision';
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    url: NVIDIA_BASE,
    model: NVIDIA_DEFAULT_MODEL,
  },
  {
    id: 'gemini',
    label: 'Gemini',
    url: GEMINI_BASE,
    model: 'gemini-2.0-flash',
  },
  {
    id: 'groq',
    label: 'Groq (rápido)',
    url: 'https://api.groq.com/openai/v1',
    model: 'llama-3.1-8b-instant',
  },
  {
    id: 'anthropic',
    label: 'Claude',
    url: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    url: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    url: 'https://api.x.ai/v1',
    model: 'grok-2-latest',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
  },
  {
    id: 'ollama',
    label: 'Ollama local',
    url: 'http://localhost:11434/v1',
    model: 'llama3.2',
  },
];

/**
 * Catálogo curado de los mejores modelos en NVIDIA NIM (build.nvidia.com).
 * IDs oficiales para integrate.api.nvidia.com/v1/chat/completions
 */
export const NVIDIA_MODEL_OPTIONS: NvidiaModelOption[] = [
  /* —— Nemotron 3 (NVIDIA) —— */
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b',
    label: 'Nemotron 3 Ultra 550B',
    tier: 'ultra',
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    label: 'Nemotron 3 Super 120B',
    tier: 'pro',
  },
  {
    id: 'nvidia/nemotron-3-nano-30b-a3b',
    label: 'Nemotron 3 Nano 30B',
    tier: 'fast',
  },
  {
    id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    label: 'Nemotron Super 49B v1.5',
    tier: 'pro',
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    label: 'Nemotron 70B Instruct',
    tier: 'pro',
  },
  {
    id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
    label: 'Nemotron Ultra 253B',
    tier: 'ultra',
  },
  {
    id: 'nvidia/llama-3.1-nemotron-nano-8b-v1',
    label: 'Nemotron Nano 8B',
    tier: 'fast',
  },

  /* —— Meta Llama —— */
  {
    id: 'meta/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B',
    tier: 'pro',
  },
  {
    id: 'meta/llama-3.1-70b-instruct',
    label: 'Llama 3.1 70B',
    tier: 'pro',
  },
  {
    id: 'meta/llama-3.1-405b-instruct',
    label: 'Llama 3.1 405B',
    tier: 'ultra',
  },
  {
    id: 'meta/llama-3.1-8b-instruct',
    label: 'Llama 3.1 8B',
    tier: 'fast',
  },
  {
    id: 'meta/llama-4-maverick-17b-128e-instruct',
    label: 'Llama 4 Maverick',
    tier: 'pro',
  },
  {
    id: 'meta/llama-4-scout-17b-16e-instruct',
    label: 'Llama 4 Scout',
    tier: 'fast',
  },

  /* —— DeepSeek —— */
  {
    id: 'deepseek-ai/deepseek-r1',
    label: 'DeepSeek R1',
    tier: 'ultra',
  },
  {
    id: 'deepseek-ai/deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    tier: 'ultra',
  },
  {
    id: 'deepseek-ai/deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    tier: 'fast',
  },
  {
    id: 'deepseek-ai/deepseek-r1-distill-llama-70b',
    label: 'DeepSeek R1 Distill 70B',
    tier: 'pro',
  },

  /* —— Código / razonamiento —— */
  {
    id: 'moonshotai/kimi-k2.6',
    label: 'Kimi K2.6',
    tier: 'code',
  },
  {
    id: 'qwen/qwen3-next-80b-a3b-thinking',
    label: 'Qwen3 Next 80B Think',
    tier: 'code',
  },
  {
    id: 'qwen/qwen2.5-coder-32b-instruct',
    label: 'Qwen2.5 Coder 32B',
    tier: 'code',
  },
  {
    id: 'mistralai/mistral-large-2-instruct',
    label: 'Mistral Large 2',
    tier: 'pro',
  },
  {
    id: 'mistralai/mixtral-8x22b-instruct-v0.1',
    label: 'Mixtral 8x22B',
    tier: 'pro',
  },

  /* —— Visión / multimodales —— */
  {
    id: 'meta/llama-3.2-90b-vision-instruct',
    label: 'Llama 3.2 90B Vision',
    tier: 'vision',
  },
  {
    id: 'meta/llama-3.2-11b-vision-instruct',
    label: 'Llama 3.2 11B Vision',
    tier: 'vision',
  },
];

/** Lista plana de IDs (compat UI simple) */
export const NVIDIA_MODELS = NVIDIA_MODEL_OPTIONS.map((m) => m.id);

export const NVIDIA_TIER_LABELS: Record<NvidiaModelOption['tier'], string> = {
  ultra: 'Máxima potencia',
  pro: 'Producción',
  fast: 'Rápido',
  code: 'Código / razonamiento',
  vision: 'Visión',
};

export const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-flash-latest',
];

export function detectFromKey(key: string): {
  baseUrl: string;
  model: string;
  provider: ProviderId;
} | null {
  const k = key.trim();
  if (k.startsWith('gsk_')) {
    return {
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-3.1-8b-instant',
      provider: 'groq',
    };
  }
  if (k.startsWith('sk-ant-')) {
    return {
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
    };
  }
  if (k.startsWith('AIza') || k.startsWith('AQ.')) {
    return { baseUrl: GEMINI_BASE, model: 'gemini-2.0-flash', provider: 'gemini' };
  }
  if (k.startsWith('nvapi-')) {
    return {
      baseUrl: NVIDIA_BASE,
      model: NVIDIA_DEFAULT_MODEL,
      provider: 'nvidia',
    };
  }
  if (k.startsWith('sk-or-')) {
    return {
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-4o-mini',
      provider: 'openrouter',
    };
  }
  if (k.startsWith('xai-')) {
    return { baseUrl: 'https://api.x.ai/v1', model: 'grok-2-latest', provider: 'xai' };
  }
  if (k.startsWith('sk-') && k.length > 20) {
    return { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', provider: 'openai' };
  }
  return null;
}

export function isGeminiUrl(url: string) {
  return url.includes('generativelanguage') || url.includes('googleapis');
}

export function isNvidiaUrl(url: string) {
  return url.includes('integrate.api.nvidia') || url.includes('nvidia.com');
}
