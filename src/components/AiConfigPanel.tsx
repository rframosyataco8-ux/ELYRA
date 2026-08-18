import { useMemo, useState } from 'react';
import {
  Key,
  Check,
  Save,
  Loader2,
  Wifi,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { validateAiConfig } from '@/lib/validateConfig';
import { captureError } from '@/lib/errors';
import {
  detectFromKey,
  PROVIDER_PRESETS,
  GEMINI_MODELS,
  NVIDIA_MODELS,
  isGeminiUrl,
  isNvidiaUrl,
} from '@/lib/providers';

function fieldBorder(ok: boolean, touched: boolean): string {
  if (!touched) return 'var(--ely-border)';
  return ok ? 'rgba(63, 185, 80, 0.5)' : 'rgba(248, 81, 73, 0.6)';
}

export interface AiConfigPanelProps {
  hasApiKey: boolean;
  onHasApiKeyChange: (v: boolean) => void;
  cfgLoaded: boolean;
  isDesktop: boolean;
}

export function AiConfigPanel({
  hasApiKey,
  onHasApiKeyChange,
  cfgLoaded,
  isDesktop,
}: AiConfigPanelProps) {
  const [cfgApiKey, setCfgApiKey] = useState('');
  const [cfgBaseUrl, setCfgBaseUrl] = useState('https://api.groq.com/openai/v1');
  const [cfgModel, setCfgModel] = useState('llama-3.3-70b-versatile');
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgSaved, setCfgSaved] = useState(false);
  const [cfgTesting, setCfgTesting] = useState(false);
  const [cfgTestMsg, setCfgTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cfgTouched, setCfgTouched] = useState(false);
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const isGemini = detectedProvider === 'gemini' || isGeminiUrl(cfgBaseUrl);
  const isNvidia = detectedProvider === 'nvidia' || isNvidiaUrl(cfgBaseUrl);

  const liveValidation = useMemo(
    () =>
      validateAiConfig({
        baseUrl: cfgBaseUrl,
        model: cfgModel,
        apiKey: cfgApiKey,
        hasStoredKey: hasApiKey,
      }),
    [cfgBaseUrl, cfgModel, cfgApiKey, hasApiKey],
  );

  // Hidratar desde Electron una sola vez cuando cfgLoaded
  if (cfgLoaded && !hydrated && isDesktop && typeof window !== 'undefined' && window.elyra) {
    setHydrated(true);
    window.elyra
      .agentConfigGet()
      .then((c) => {
        onHasApiKeyChange(c.hasKey);
        if (c.baseUrl) setCfgBaseUrl(c.baseUrl);
        if (c.model) setCfgModel(c.model);
      })
      .catch(() => {});
  }

  const touchConfig = () => setCfgTouched(true);

  const onApiKeyChange = (value: string) => {
    touchConfig();
    setCfgApiKey(value);
    setCfgTestMsg(null);
    const det = detectFromKey(value);
    if (det) {
      setCfgBaseUrl(det.baseUrl);
      setCfgModel(det.model);
      setDetectedProvider(det.provider);
    } else {
      setDetectedProvider(null);
    }
  };

  const handleSaveConfig = async () => {
    if (!isDesktop || !window.elyra || !cfgLoaded) return;
    touchConfig();
    if (!liveValidation.ok) {
      setCfgTestMsg({ ok: false, text: liveValidation.firstError || 'Revise el formulario.' });
      return;
    }
    setCfgSaving(true);
    setCfgSaved(false);
    setCfgTestMsg(null);
    try {
      const result = await window.elyra.agentConfigSet({
        apiKey: cfgApiKey.trim() || undefined,
        baseUrl: cfgBaseUrl.trim(),
        model: cfgModel.trim(),
      });
      onHasApiKeyChange(result.hasKey);
      if (result.baseUrl) setCfgBaseUrl(result.baseUrl);
      if (result.model) setCfgModel(result.model);
      setCfgSaved(true);
      setTimeout(() => setCfgSaved(false), 2500);
      if (cfgApiKey.trim()) setCfgApiKey('');
    } catch (err) {
      setCfgTestMsg({ ok: false, text: captureError(err, 'No se pudo guardar.') });
    } finally {
      setCfgSaving(false);
    }
  };

  const handleTestConfig = async () => {
    if (!isDesktop || !window.elyra || !cfgLoaded) return;
    touchConfig();
    if (!liveValidation.ok) {
      setCfgTestMsg({ ok: false, text: liveValidation.firstError || 'Revise el formulario.' });
      return;
    }
    setCfgTesting(true);
    setCfgTestMsg(null);
    try {
      if (cfgApiKey.trim()) {
        await window.elyra.agentConfigSet({
          apiKey: cfgApiKey.trim(),
          baseUrl: cfgBaseUrl.trim(),
          model: cfgModel.trim(),
        });
        setCfgApiKey('');
      } else {
        await window.elyra.agentConfigSet({
          baseUrl: cfgBaseUrl.trim(),
          model: cfgModel.trim(),
        });
      }
      const test = await window.elyra.agentConfigTest({
        baseUrl: cfgBaseUrl.trim(),
        model: cfgModel.trim(),
      });
      const c = await window.elyra.agentConfigGet();
      onHasApiKeyChange(c.hasKey);
      setCfgTestMsg({ ok: test.ok, text: test.message });
    } catch (err) {
      setCfgTestMsg({ ok: false, text: captureError(err, 'Error al probar la conexión.') });
    } finally {
      setCfgTesting(false);
    }
  };

  const keyPlaceholder = hasApiKey
    ? '••••••••  (pegue una nueva para reemplazar)'
    : isNvidia
      ? 'nvapi-…'
      : isGemini
        ? 'AIza… o AQ.…'
        : 'pegue su API key';

  return (
    <div className="hud-glass-strong p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--ely-text)' }}>
          <Key className="w-3.5 h-3.5" style={{ color: 'var(--ely-accent)' }} />
          Proveedor de IA
        </h3>
        {!cfgLoaded ? (
          <span className="text-[11px]" style={{ color: 'var(--ely-text-dim)' }}>Cargando…</span>
        ) : hasApiKey ? (
          <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--ely-success)' }}>
            <Check className="w-3 h-3" /> Conectada
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: 'var(--ely-warning)' }}>Sin clave</span>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium" style={{ color: 'var(--ely-text-muted)' }}>
          Proveedor
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PROVIDER_PRESETS.map((p) => {
            const active = cfgBaseUrl === p.url || cfgBaseUrl.startsWith(p.url);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  touchConfig();
                  setCfgBaseUrl(p.url);
                  setCfgModel(p.model);
                  setCfgTestMsg(null);
                  setDetectedProvider(p.id);
                }}
                className="text-[11px] px-2.5 py-1.5 rounded-full border transition-all duration-200 ely-chip-btn"
                style={{
                  background: active ? 'var(--ely-accent-soft)' : 'transparent',
                  borderColor: active ? 'var(--ely-accent)' : 'var(--ely-border)',
                  color: active ? 'var(--ely-accent)' : 'var(--ely-text-muted)',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {isNvidia && (
        <div
          className="rounded-xl px-3 py-2.5 text-[12px] space-y-1.5"
          style={{
            background: 'var(--ely-accent-soft)',
            border: '1px solid var(--ely-border)',
            color: 'var(--ely-text-muted)',
          }}
        >
          <p style={{ color: 'var(--ely-text)' }} className="font-medium text-[12px]">
            NVIDIA NIM · build.nvidia.com
          </p>
          <p>
            Pegue la clave <code className="text-[11px]">nvapi-…</code> de{' '}
            <a
              href="https://build.nvidia.com/settings/api-keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5"
              style={{ color: 'var(--ely-accent)' }}
            >
              NVIDIA API Keys <ExternalLink className="w-3 h-3" />
            </a>
            .
          </p>
          <div className="flex flex-wrap gap-1 pt-1">
            {NVIDIA_MODELS.slice(0, 12).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  touchConfig();
                  setCfgModel(m);
                }}
                className="text-[10px] px-2 py-1 rounded-full border transition-all ely-chip-btn"
                style={{
                  background: cfgModel === m ? 'var(--ely-accent)' : 'transparent',
                  borderColor: cfgModel === m ? 'var(--ely-accent)' : 'var(--ely-border)',
                  color: cfgModel === m ? '#fff' : 'var(--ely-text-muted)',
                }}
              >
                {m.split('/').pop()}
              </button>
            ))}
          </div>
        </div>
      )}

      {isGemini && (
        <div
          className="rounded-xl px-3 py-2.5 text-[12px] space-y-1.5"
          style={{
            background: 'var(--ely-accent-soft)',
            border: '1px solid var(--ely-border)',
            color: 'var(--ely-text-muted)',
          }}
        >
          <p style={{ color: 'var(--ely-text)' }} className="font-medium text-[12px]">
            Google AI Studio · Gemini
          </p>
          <p>
            Pegue la clave de{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5"
              style={{ color: 'var(--ely-accent)' }}
            >
              AI Studio <ExternalLink className="w-3 h-3" />
            </a>
            .
          </p>
          <div className="flex flex-wrap gap-1 pt-1">
            {GEMINI_MODELS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  touchConfig();
                  setCfgModel(m);
                }}
                className="text-[10px] px-2 py-1 rounded-full border transition-all ely-chip-btn"
                style={{
                  background: cfgModel === m ? 'var(--ely-accent)' : 'transparent',
                  borderColor: cfgModel === m ? 'var(--ely-accent)' : 'var(--ely-border)',
                  color: cfgModel === m ? '#fff' : 'var(--ely-text-muted)',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium" style={{ color: 'var(--ely-text-muted)' }}>
          API Key
        </label>
        <input
          type="password"
          value={cfgApiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={keyPlaceholder}
          className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none ely-focus-ring"
          style={{
            background: 'var(--ely-input-bg)',
            border: `1px solid ${fieldBorder(liveValidation.fields.apiKey.ok, cfgTouched)}`,
            color: 'var(--ely-text)',
          }}
          autoComplete="off"
          spellCheck={false}
        />
        {cfgTouched && !liveValidation.fields.apiKey.ok && (
          <p className="text-[11px]" style={{ color: 'var(--ely-danger)' }}>
            {liveValidation.fields.apiKey.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium" style={{ color: 'var(--ely-text-muted)' }}>
            Base URL
          </label>
          <input
            value={cfgBaseUrl}
            onChange={(e) => {
              touchConfig();
              setCfgBaseUrl(e.target.value);
              setCfgTestMsg(null);
            }}
            className="w-full rounded-xl px-3 py-2 text-xs outline-none ely-focus-ring"
            style={{
              background: 'var(--ely-input-bg)',
              border: `1px solid ${fieldBorder(liveValidation.fields.baseUrl.ok, cfgTouched)}`,
              color: 'var(--ely-text)',
            }}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium" style={{ color: 'var(--ely-text-muted)' }}>
            Modelo
          </label>
          <input
            value={cfgModel}
            onChange={(e) => {
              touchConfig();
              setCfgModel(e.target.value);
              setCfgTestMsg(null);
            }}
            className="w-full rounded-xl px-3 py-2 text-xs outline-none ely-focus-ring"
            style={{
              background: 'var(--ely-input-bg)',
              border: `1px solid ${fieldBorder(liveValidation.fields.model.ok, cfgTouched)}`,
              color: 'var(--ely-text)',
            }}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={cfgSaving || !isDesktop || !cfgLoaded}
          className="ely-btn-primary flex-1 disabled:opacity-40"
        >
          {cfgSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : cfgSaved ? (
            <>
              <Check className="w-4 h-4" /> Guardado
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Guardar
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleTestConfig}
          disabled={cfgTesting || !isDesktop || !cfgLoaded}
          className="ely-btn-secondary flex-1 disabled:opacity-40"
        >
          {cfgTesting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Wifi className="w-4 h-4" /> Probar
            </>
          )}
        </button>
      </div>

      {cfgTestMsg && (
        <div
          className="flex items-start gap-2 text-[12px] rounded-xl px-3 py-2.5"
          style={{
            background: cfgTestMsg.ok ? 'rgba(63, 185, 80, 0.1)' : 'rgba(248, 81, 73, 0.1)',
            border: `1px solid ${
              cfgTestMsg.ok ? 'rgba(63, 185, 80, 0.25)' : 'rgba(248, 81, 73, 0.25)'
            }`,
            color: cfgTestMsg.ok ? 'var(--ely-success)' : 'var(--ely-danger)',
          }}
        >
          {cfgTestMsg.ok ? (
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{cfgTestMsg.text}</span>
        </div>
      )}
    </div>
  );
}
