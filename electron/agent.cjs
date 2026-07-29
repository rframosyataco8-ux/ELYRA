/**
 * ELYRA Agent v2 — autonomía operativa ampliada
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_GROQ_KEY = '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';
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const MODEL_CHAIN = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'gemma2-9b-it',
  'llama-3.1-70b-versatile',
];

const SYSTEM_PROMPT = `Eres ELYRA, la compañera de trabajo inteligente del usuario en su PC. Hablas español como una persona real: cercana, clara, proactiva y sin relleno robótico.

CÓMO HABLAS (respuesta final, se escucha en voz alta):
- Como una colega competente, no como un manual.
- 1 a 4 frases en la mayoría de casos. Si pide explicación larga, desarrolla con naturalidad.
- Nunca digas rutas con barras invertidas. Di "en Documentos, carpeta Informes".
- Nada de markdown, JSON, códigos de error ni bloques técnicos en la respuesta final.
- Si algo falló, dilo con sencillez y ofrece el siguiente paso útil.

AUTONOMÍA:
- Si la petición implica varios pasos, ejecútalos tú con herramientas sin pedir permiso por cada uno.
- Anticipa lo obvio: si piden un reporte, créalo y confirma dónde quedó.
- Si falta un dato crítico (nombre de archivo inexistente), pregunta en una sola frase.

HERRAMIENTAS (úsalas con el formato exacto):

[TOOL: web_search]
query: texto
[/TOOL]

[TOOL: create_file]
path: Informes/archivo.txt
content: contenido completo
[/TOOL]

[TOOL: create_html_report]
path: Informes/reporte.html
title: título
body: html del cuerpo
[/TOOL]

[TOOL: append_file]
path: archivo
content: texto a añadir al final
[/TOOL]

[TOOL: delete_file]
path: archivo a eliminar
[/TOOL]

[TOOL: create_folder]
path: nombre o ruta
[/TOOL]

[TOOL: open_app]
name: chrome | code | notepad | calculadora | spotify | excel | word
[/TOOL]

[TOOL: open_folder]
name: documentos | descargas | escritorio | informes | imagenes | musica | videos
[/TOOL]

[TOOL: open_url]
url: https://...
[/TOOL]

[TOOL: read_file]
path: archivo
[/TOOL]

[TOOL: list_dir]
path: carpeta
[/TOOL]

[TOOL: run_command]
command: comando seguro
[/TOOL]

[TOOL: remember]
text: dato a recordar
[/TOOL]

[TOOL: recall]
[/TOOL]

[TOOL: get_system_info]
[/TOOL]

[TOOL: write_desktop_note]
filename: nota.txt
content: texto
[/TOOL]

Tras herramientas, cierra con respuesta FINAL natural para voz.`;

function getConfigPath() {
  return path.join(os.homedir(), '.elyra', 'config.json');
}

function ensureDefaultConfig() {
  const p = getConfigPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(p)) {
    fs.writeFileSync(
      p,
      JSON.stringify(
        { apiKey: DEFAULT_GROQ_KEY, baseUrl: DEFAULT_BASE_URL, model: MODEL_CHAIN[0] },
        null,
        2,
      ),
      'utf-8',
    );
  }
}

function getConfig() {
  ensureDefaultConfig();
  try {
    const c = JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'));
    return {
      apiKey: c.apiKey || DEFAULT_GROQ_KEY,
      baseUrl: c.baseUrl || DEFAULT_BASE_URL,
      model: c.model || MODEL_CHAIN[0],
    };
  } catch {
    return { apiKey: DEFAULT_GROQ_KEY, baseUrl: DEFAULT_BASE_URL, model: MODEL_CHAIN[0] };
  }
}

function saveConfig(partial) {
  ensureDefaultConfig();
  const next = { ...getConfig(), ...partial };
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function resolveUserPath(filePath) {
  if (!filePath) return path.join(os.homedir(), 'Documents', 'elyra-output.txt');
  if (path.isAbsolute(filePath)) return filePath;
  const docs = path.join(os.homedir(), 'Documents');
  const normalized = filePath.replace(/\\/g, '/');
  if (/^informes\//i.test(normalized) || /^desktop\//i.test(normalized) || /^escritorio\//i.test(normalized)) {
    if (/^informes\//i.test(normalized)) {
      const informes = path.join(docs, 'Informes');
      if (!fs.existsSync(informes)) fs.mkdirSync(informes, { recursive: true });
      return path.join(docs, normalized);
    }
    return path.join(os.homedir(), 'Desktop', path.basename(normalized));
  }
  return path.join(docs, filePath);
}

async function callLLMOnce(messages, config, model) {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.55, max_tokens: 4096 }),
  });
  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`LLM ${res.status}: ${errText.slice(0, 280)}`);
    err.status = res.status;
    err.body = errText;
    throw err;
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callLLM(messages, config) {
  if (!config.apiKey) throw new Error('NO_API_KEY');
  const preferred = config.model || MODEL_CHAIN[0];
  const chain = [preferred, ...MODEL_CHAIN.filter((m) => m !== preferred)];
  let lastErr;
  for (const model of chain) {
    try {
      return await callLLMOnce(messages, config, model);
    } catch (e) {
      lastErr = e;
      if (e.status === 429 || /rate limit|429|TPD|TPM/i.test(String(e.message) + String(e.body || ''))) {
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error('Límite de uso. Espera un minuto.');
}

function parseTools(text) {
  const tools = [];
  const re = /\[TOOL:\s*([\w_]+)\]([\s\S]*?)\[\/TOOL\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].trim().toLowerCase();
    const body = m[2].trim();
    const params = {};
    let currentKey = null;
    let currentVal = [];
    for (const line of body.split('\n')) {
      const km = line.match(/^([\w_]+):\s*(.*)$/);
      if (km && !line.startsWith(' ')) {
        if (currentKey) params[currentKey] = currentVal.join('\n').trim();
        currentKey = km[1].toLowerCase();
        currentVal = [km[2]];
      } else if (currentKey) currentVal.push(line);
    }
    if (currentKey) params[currentKey] = currentVal.join('\n').trim();
    tools.push({ name, params });
  }
  return tools;
}

function stripTools(text) {
  return text.replace(/\[TOOL:\s*[\w_]+\][\s\S]*?\[\/TOOL\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
}

function polishForSpeech(text) {
  if (!text) return '';
  let t = stripTools(text);
  if (/rate limit|429|tokens per/i.test(t)) {
    return 'El servicio está un poco saturado. Espera medio minuto y lo intentamos otra vez.';
  }
  t = t.replace(/[A-Za-z]:\\[^\s\]"']+/g, 'Documentos');
  t = t.replace(/\\+/g, ' ');
  t = t.replace(/\*\*?/g, '');
  t = t.replace(/`+/g, '');
  t = t.replace(/\{[\s\S]*\}/g, '');
  return t.replace(/\s+/g, ' ').trim();
}

async function executeTool(tool, helpers) {
  const { name, params } = tool;
  try {
    switch (name) {
      case 'web_search': {
        const q = params.query || '';
        if (!q) return { ok: false, result: 'Falta query' };
        const results = [];
        try {
          const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            },
          });
          const html = await res.text();
          const re = /class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td)>/gi;
          let sm;
          while ((sm = re.exec(html)) !== null && results.length < 6) {
            const t = sm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (t.length > 30) results.push(t);
          }
        } catch (e) {
          results.push(`(Búsqueda: ${e.message})`);
        }
        try {
          for (const lang of ['es', 'en']) {
            const wr = await fetch(
              `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`,
              { headers: { 'User-Agent': 'ELYRA/2.0' } },
            );
            if (wr.ok) {
              const data = await wr.json();
              if (data.extract) {
                results.unshift(`Wikipedia: ${data.extract}`);
                break;
              }
            }
          }
        } catch {}
        if (!results.length) return { ok: true, result: `Sin resultados para: ${q}` };
        return {
          ok: true,
          result: results.map((r, i) => `${i + 1}. ${r}`).join('\n'),
        };
      }

      case 'create_file': {
        const filePath = resolveUserPath(params.path || 'elyra-output.txt');
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, params.content || '', 'utf-8');
        return { ok: true, result: `Creado ${path.basename(filePath)}` };
      }

      case 'append_file': {
        const filePath = resolveUserPath(params.path || 'elyra-notes.txt');
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(filePath, (params.content || '') + '\n', 'utf-8');
        return { ok: true, result: `Añadido a ${path.basename(filePath)}` };
      }

      case 'delete_file': {
        const filePath = resolveUserPath(params.path || '');
        if (!params.path) return { ok: false, result: 'Falta path' };
        // Seguridad: solo dentro de home del usuario
        const home = os.homedir();
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(path.resolve(home))) {
          return { ok: false, result: 'Solo puedo borrar archivos dentro de tu carpeta de usuario.' };
        }
        if (!fs.existsSync(resolved)) return { ok: false, result: 'El archivo no existe' };
        fs.unlinkSync(resolved);
        return { ok: true, result: `Eliminado ${path.basename(resolved)}` };
      }

      case 'create_html_report': {
        const filePath = resolveUserPath(params.path || 'Informes/reporte.html');
        const title = params.title || 'Reporte ELYRA';
        const body = params.body || '<p>Sin contenido</p>';
        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>${title.replace(/</g, '')}</title>
<style>body{font-family:Segoe UI,system-ui,sans-serif;max-width:900px;margin:48px auto;padding:0 28px 64px;line-height:1.7;color:#0f172a}
h1{color:#0284c7;border-bottom:3px solid #e0f2fe;padding-bottom:12px}h2{color:#0369a1;margin-top:1.8em}.meta{color:#64748b;font-size:.9rem}</style></head>
<body><h1>${title.replace(/</g, '')}</h1><p class="meta">ELYRA · ${new Date().toLocaleString('es-ES')}</p>${body}</body></html>`;
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const finalPath = filePath.toLowerCase().endsWith('.html') ? filePath : filePath + '.html';
        fs.writeFileSync(finalPath, html, 'utf-8');
        return { ok: true, result: `Reporte ${path.basename(finalPath)} listo` };
      }

      case 'create_folder': {
        const folderPath = resolveUserPath(params.path || 'Informes');
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
        return { ok: true, result: `Carpeta ${path.basename(folderPath)} lista` };
      }

      case 'write_desktop_note': {
        const name = params.filename || `nota-elyra-${Date.now()}.txt`;
        const p = path.join(os.homedir(), 'Desktop', path.basename(name));
        fs.writeFileSync(p, params.content || '', 'utf-8');
        return { ok: true, result: `Nota en el escritorio: ${path.basename(p)}` };
      }

      case 'open_app':
        return await helpers.openApp(params.name || '');
      case 'open_folder':
        return await helpers.openFolder(params.name || '');
      case 'open_url':
        return await helpers.openUrl(params.url || '');

      case 'read_file': {
        let p = params.path;
        if (!p) return { ok: false, result: 'Falta path' };
        if (!path.isAbsolute(p)) p = resolveUserPath(p);
        const candidates = [
          p,
          path.join(os.homedir(), 'Documents', params.path),
          path.join(os.homedir(), 'Downloads', params.path),
          path.join(os.homedir(), 'Desktop', params.path),
        ];
        let found = null;
        for (const c of candidates) {
          if (c && fs.existsSync(c) && fs.statSync(c).isFile()) {
            found = c;
            break;
          }
        }
        if (!found) return { ok: false, result: `No existe ${params.path}` };
        if (fs.statSync(found).size > 800_000) return { ok: false, result: 'Archivo muy grande' };
        return {
          ok: true,
          result: `${path.basename(found)}:\n${fs.readFileSync(found, 'utf-8').slice(0, 20000)}`,
        };
      }

      case 'list_dir': {
        let p = params.path || path.join(os.homedir(), 'Documents');
        if (!path.isAbsolute(p)) p = resolveUserPath(p);
        if (!fs.existsSync(p)) return { ok: false, result: 'Carpeta no existe' };
        const items = fs.readdirSync(p, { withFileTypes: true }).slice(0, 100);
        return {
          ok: true,
          result: items.map((d) => `${d.isDirectory() ? '[DIR]' : '[FILE]'} ${d.name}`).join('\n'),
        };
      }

      case 'run_command':
        return await helpers.runCommand(params.command || '');
      case 'remember':
        return await helpers.remember(params.text || '');
      case 'recall': {
        if (helpers.recall) return await helpers.recall();
        return { ok: true, result: 'Sin notas en memoria' };
      }
      case 'get_system_info': {
        if (helpers.getSystemStats) {
          const s = await helpers.getSystemStats();
          return {
            ok: true,
            result: `CPU ${s.cpu}%, RAM ${s.ram}%, disco ${s.disk}%.`,
          };
        }
        return { ok: true, result: `Equipo ${os.hostname()}` };
      }

      default:
        return { ok: false, result: `Herramienta desconocida: ${name}` };
    }
  } catch (e) {
    return { ok: false, result: e.message };
  }
}

async function runAgent(userMessage, history, helpers) {
  const config = getConfig();
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-14).map((h) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.text,
    })),
    { role: 'user', content: userMessage },
  ];

  let finalText = '';
  let iterations = 0;
  const maxIter = 8;

  while (iterations < maxIter) {
    iterations++;
    let reply;
    try {
      reply = await callLLM(messages, config);
    } catch (e) {
      if (/429|rate limit/i.test(String(e.message))) {
        return {
          response: 'El servicio de inteligencia está saturado un momento. Espera un poco y lo retomo.',
          iterations,
        };
      }
      return {
        response: 'No pude conectar ahora. Revisa internet e inténtalo otra vez.',
        iterations,
      };
    }

    const tools = parseTools(reply);
    if (tools.length === 0) {
      finalText = polishForSpeech(reply);
      break;
    }

    const results = [];
    for (const t of tools) {
      results.push({ tool: t.name, ...(await executeTool(t, helpers)) });
    }

    messages.push({ role: 'assistant', content: reply });
    messages.push({
      role: 'user',
      content:
        'Resultados:\n' +
        results.map((r) => `• ${r.tool}: ${r.ok ? 'OK' : 'ERROR'} — ${r.result}`).join('\n') +
        '\n\nRespuesta FINAL natural para voz, sin TOOL ni rutas técnicas.',
    });
  }

  if (!finalText) {
    const last = messages.filter((m) => m.role === 'assistant').pop();
    finalText = last ? polishForSpeech(last.content) : 'Listo.';
  }

  return { response: finalText, iterations };
}

function fallbackResponse() {
  return { response: 'No pude conectar con el modelo.', intelligent: false };
}

module.exports = {
  runAgent,
  getConfig,
  saveConfig,
  fallbackResponse,
  callLLM,
  getConfigPath,
  ensureDefaultConfig,
  MODEL_CHAIN,
};
