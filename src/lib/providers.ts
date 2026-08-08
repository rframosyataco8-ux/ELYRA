/** Detección automática de proveedores de IA a partir de la API key */

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

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

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    url: NVIDIA_BASE,
    model: 'meta/llama-3.1-8b-instruct',
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

export const NVIDIA_MODELS = [
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.3-70b-instruct',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'mistralai/mistral-large-2-instruct',
  'google/gemma-2-27b-it',
  'microsoft/phi-3.5-mini-instruct',
];

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
      model: 'meta/llama-3.1-8b-instruct',
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
