/**
 * Puente opcional a OpenClaw (gateway local).
 * Si OpenClaw no está corriendo, devuelve ok:false y ELYRA sigue con Groq.
 *
 * Config en ~/.elyra/config.json:
 *   "openclaw": { "enabled": true, "baseUrl": "http://127.0.0.1:18789", "token": "" }
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

function getOpenClawConfig() {
  try {
    const p = path.join(os.homedir(), '.elyra', 'config.json');
    if (!fs.existsSync(p)) return { enabled: false, baseUrl: 'http://127.0.0.1:18789', token: '' };
    const c = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const oc = c.openclaw || {};
    return {
      enabled: !!oc.enabled,
      baseUrl: (oc.baseUrl || 'http://127.0.0.1:18789').replace(/\/$/, ''),
      token: oc.token || process.env.OPENCLAW_TOKEN || '',
    };
  } catch {
    return { enabled: false, baseUrl: 'http://127.0.0.1:18789', token: '' };
  }
}

async function pingOpenClaw() {
  const cfg = getOpenClawConfig();
  if (!cfg.enabled) return { ok: false, reason: 'disabled' };
  try {
    const headers = { Accept: 'application/json' };
    if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
    const res = await fetch(`${cfg.baseUrl}/health`, { method: 'GET', headers, signal: AbortSignal.timeout(2500) });
    if (!res.ok) return { ok: false, reason: `status ${res.status}` };
    return { ok: true, baseUrl: cfg.baseUrl };
  } catch (e) {
    // probar raíz
    try {
      const res = await fetch(cfg.baseUrl, { method: 'GET', signal: AbortSignal.timeout(2000) });
      return { ok: res.ok || res.status < 500, baseUrl: cfg.baseUrl, reason: res.ok ? 'root' : `status ${res.status}` };
    } catch {
      return { ok: false, reason: e.message || 'unreachable' };
    }
  }
}

/**
 * Envía mensaje a OpenClaw si está disponible.
 * Endpoints tentativos (varían según versión): /v1/chat, /api/chat, /chat
 */
async function chatOpenClaw(message, history = []) {
  const cfg = getOpenClawConfig();
  if (!cfg.enabled) return { ok: false, error: 'OpenClaw desactivado en config' };

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;

  const payloads = [
    {
      path: '/v1/chat/completions',
      body: {
        model: 'openclaw',
        messages: [
          ...history.slice(-8).map((h) => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.text || h.content || '',
          })),
          { role: 'user', content: message },
        ],
      },
    },
    {
      path: '/api/chat',
      body: { message, history },
    },
    {
      path: '/chat',
      body: { message },
    },
  ];

  for (const p of payloads) {
    try {
      const res = await fetch(`${cfg.baseUrl}${p.path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(p.body),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text =
        data.choices?.[0]?.message?.content ||
        data.response ||
        data.message ||
        data.text ||
        data.reply ||
        '';
      if (text) return { ok: true, response: String(text).trim(), via: 'openclaw' };
    } catch {
      continue;
    }
  }

  return {
    ok: false,
    error:
      'OpenClaw no respondió. ¿Está el gateway en marcha? Revisa openclaw.enabled y baseUrl en ~/.elyra/config.json',
  };
}

module.exports = { getOpenClawConfig, pingOpenClaw, chatOpenClaw };
