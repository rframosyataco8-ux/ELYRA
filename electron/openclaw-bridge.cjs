/**
 * Puente OpenClaw v2 — cliente del Gateway local (hub-and-spoke).
 *
 * Arquitectura real (docs comunitarias):
 * - Gateway demonio en 127.0.0.1:18789 (HTTP + WebSocket)
 * - Endpoints OpenAI-compat: /v1/chat/completions, /v1/responses, /v1/models
 * - RPC WS: chat.send, tools.invoke, sessions.*, etc.
 *
 * ELYRA NO depende de OpenClaw para controlar el PC: ya tiene tools nativas.
 * Si el gateway está activo, puede usarse como cerebro/orquestador externo.
 *
 * Config ~/.elyra/config.json:
 * {
 *   "openclaw": {
 *     "enabled": true,
 *     "baseUrl": "http://127.0.0.1:18789",
 *     "token": "",
 *     "prefer": true
 *   }
 * }
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_URL = 'http://127.0.0.1:18789';

function readRootConfig() {
  try {
    const p = path.join(os.homedir(), '.elyra', 'config.json');
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return {};
  }
}

function getOpenClawConfig() {
  const c = readRootConfig();
  const oc = c.openclaw || {};
  return {
    enabled: !!oc.enabled,
    prefer: oc.prefer !== false,
    baseUrl: String(oc.baseUrl || process.env.OPENCLAW_URL || DEFAULT_URL).replace(/\/$/, ''),
    token: oc.token || process.env.OPENCLAW_GATEWAY_TOKEN || process.env.OPENCLAW_TOKEN || '',
    agentId: oc.agentId || process.env.OPENCLAW_AGENT_ID || '',
  };
}

function authHeaders(cfg) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (cfg.token) {
    headers.Authorization = 'Bearer ' + cfg.token;
    headers['x-openclaw-token'] = cfg.token;
  }
  return headers;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(options.timeoutMs || 8000),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 400) };
  }
  return { ok: res.ok, status: res.status, data, text };
}

/**
 * Health del gateway: /health, /v1/models, raíz.
 */
async function pingOpenClaw() {
  const cfg = getOpenClawConfig();
  if (!cfg.enabled) {
    return { ok: false, reason: 'disabled', enabled: false, baseUrl: cfg.baseUrl };
  }

  const headers = authHeaders(cfg);
  const probes = ['/health', '/v1/models', '/', '/api/health'];

  for (const p of probes) {
    try {
      const r = await fetchJson(cfg.baseUrl + p, {
        method: 'GET',
        headers,
        timeoutMs: 2500,
      });
      if (r.ok || (r.status > 0 && r.status < 500)) {
        return {
          ok: true,
          enabled: true,
          baseUrl: cfg.baseUrl,
          probe: p,
          status: r.status,
          models: Array.isArray(r.data?.data) ? r.data.data.slice(0, 5).map((m) => m.id || m) : undefined,
        };
      }
    } catch {
      /* next */
    }
  }

  return {
    ok: false,
    enabled: true,
    baseUrl: cfg.baseUrl,
    reason: 'Gateway no alcanzable. Ejecute: openclaw gateway  (puerto 18789)',
  };
}

function extractText(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  const c =
    data.choices?.[0]?.message?.content ||
    data.choices?.[0]?.text ||
    data.output_text ||
    data.response ||
    data.message?.content ||
    data.message ||
    data.text ||
    data.reply ||
    data.result ||
    '';
  if (Array.isArray(c)) {
    return c.map((x) => (typeof x === 'string' ? x : x?.text || '')).join('');
  }
  return String(c || '').trim();
}

/**
 * Chat vía Gateway OpenClaw.
 * Prioridad: /v1/chat/completions (documentado) → variantes legacy.
 */
async function chatOpenClaw(message, history = []) {
  const cfg = getOpenClawConfig();
  if (!cfg.enabled) return { ok: false, error: 'OpenClaw desactivado (openclaw.enabled=false)' };

  const headers = authHeaders(cfg);
  const msgs = [
    ...history.slice(-12).map((h) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.text || h.content || '',
    })),
    { role: 'user', content: message },
  ];

  const attempts = [
    {
      path: '/v1/chat/completions',
      body: {
        model: cfg.agentId || 'openclaw',
        messages: msgs,
        temperature: 0.4,
      },
    },
    {
      path: '/v1/responses',
      body: {
        model: cfg.agentId || 'openclaw',
        input: message,
      },
    },
    {
      path: '/api/chat',
      body: { message, history, agentId: cfg.agentId || undefined },
    },
    {
      path: '/chat',
      body: { message },
    },
  ];

  const errors = [];
  for (const a of attempts) {
    try {
      const r = await fetchJson(cfg.baseUrl + a.path, {
        method: 'POST',
        headers,
        body: JSON.stringify(a.body),
        timeoutMs: 90000,
      });
      if (!r.ok) {
        errors.push(a.path + '→' + r.status);
        continue;
      }
      const text = extractText(r.data);
      if (text) {
        return {
          ok: true,
          response: text,
          via: 'openclaw',
          endpoint: a.path,
        };
      }
      errors.push(a.path + '→empty');
    } catch (e) {
      errors.push(a.path + '→' + (e.message || 'err'));
    }
  }

  return {
    ok: false,
    error:
      'OpenClaw no devolvió respuesta. ' +
      (errors.slice(0, 3).join('; ') || 'sin detalle') +
      '. ¿Gateway activo? openclaw gateway',
  };
}

/**
 * Invoca una tool del gateway si expone /tools/invoke (opcional).
 */
async function invokeOpenClawTool(name, args = {}) {
  const cfg = getOpenClawConfig();
  if (!cfg.enabled) return { ok: false, error: 'disabled' };
  const headers = authHeaders(cfg);
  const paths = ['/tools/invoke', '/v1/tools/invoke', '/api/tools/invoke'];
  for (const p of paths) {
    try {
      const r = await fetchJson(cfg.baseUrl + p, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, arguments: args, args }),
        timeoutMs: 60000,
      });
      if (r.ok) {
        return {
          ok: true,
          result: extractText(r.data) || JSON.stringify(r.data).slice(0, 2000),
          via: 'openclaw-tool',
        };
      }
    } catch {
      /* next */
    }
  }
  return { ok: false, error: 'tools.invoke no disponible en este gateway' };
}

module.exports = {
  getOpenClawConfig,
  pingOpenClaw,
  chatOpenClaw,
  invokeOpenClawTool,
};
