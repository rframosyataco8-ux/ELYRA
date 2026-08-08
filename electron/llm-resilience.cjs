/**
 * ELYRA 0.3 — resiliencia LLM
 * Detección de errores de tools, reintentos y mensajes limpios.
 */

function isToolApiError(status, errText) {
  const t = String(errText || '');
  if (status === 404 && /function|tool|not found for account/i.test(t)) return true;
  if (status === 400 && /tool|function|tool_calls|tools/i.test(t)) return true;
  if (/Function '.*': Not found/i.test(t)) return true;
  if (/does not support tools|tool.?use.?not.?supported/i.test(t)) return true;
  if (/unknown.*tool|invalid.*tool/i.test(t)) return true;
  return false;
}

function isRateLimit(status, errText) {
  if (status === 429) return true;
  return /rate limit|too many requests|quota/i.test(String(errText || ''));
}

function isAuthError(status, errText) {
  if (status === 401 || status === 403) return true;
  return /invalid.*key|unauthorized|authentication|api key/i.test(String(errText || ''));
}

function cleanUserFacingError(errMsg) {
  const m = String(errMsg || '');
  if (isAuthError(0, m) || /401|unauthorized/i.test(m)) {
    return 'La API key no es válida o expiró. Revísala en Configuración.';
  }
  if (isRateLimit(0, m) || /429/.test(m)) {
    return 'El servicio de inteligencia está saturado un momento. Prueba en unos segundos.';
  }
  if (isToolApiError(404, m) || /function|tool_call/i.test(m)) {
    return 'El modelo no aceptó herramientas. Reintenté en modo conversación simple.';
  }
  if (/ENOTFOUND|ECONNREFUSED|network|fetch failed|ECONNRESET/i.test(m)) {
    return 'No hay conexión con el servicio de inteligencia. Revisa internet o la URL del proveedor.';
  }
  if (/timeout|ETIMEDOUT|aborted/i.test(m)) {
    return 'El modelo tardó demasiado. Puedo reintentar o usar búsqueda local.';
  }
  if (m.length > 160 || /[{}\[\]]/.test(m)) {
    return 'El modelo no respondió bien. Puedo usar control local del PC y búsquedas en la web.';
  }
  return 'Tuve un problema al razonar. Sigo disponible para el sistema y búsquedas.';
}

/** Modelos por defecto alineados con providers 0.3 */
const DEFAULTS = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    fallback: 'llama-3.1-8b-instant',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
    fallback: 'gemini-2.0-flash-lite',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    fallback: 'gpt-4o-mini',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
    fallback: 'claude-3-5-haiku-20241022',
  },
  xai: {
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-2-latest',
    fallback: 'grok-2-latest',
  },
  nvidia: {
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-3.3-70b-instruct',
    fallback: 'meta/llama-3.1-8b-instruct',
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    fallback: 'llama3.2',
  },
};

function fallbackModelFor(provider, current) {
  const d = DEFAULTS[provider];
  if (!d) return current;
  if (current && current !== d.fallback) return d.fallback;
  return d.fallback || current;
}

module.exports = {
  isToolApiError,
  isRateLimit,
  isAuthError,
  cleanUserFacingError,
  fallbackModelFor,
  DEFAULTS,
};
