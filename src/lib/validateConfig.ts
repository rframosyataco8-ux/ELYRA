/** Validación por pasos del formulario de proveedor de IA */

export type ConfigField = 'baseUrl' | 'model' | 'apiKey';

export type FieldResult = {
  ok: boolean;
  message?: string;
};

export type ConfigValidation = {
  ok: boolean;
  fields: Record<ConfigField, FieldResult>;
  /** Primer mensaje de error (para UI) */
  firstError: string | null;
};

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

export function validateBaseUrl(value: string): FieldResult {
  const v = value.trim();
  if (!v) return { ok: false, message: 'La Base URL es obligatoria.' };
  if (!URL_RE.test(v)) return { ok: false, message: 'La Base URL no es válida (use https://…).' };
  return { ok: true };
}

export function validateModel(value: string): FieldResult {
  const v = value.trim();
  if (!v) return { ok: false, message: 'El modelo es obligatorio.' };
  if (v.length < 2) return { ok: false, message: 'El nombre del modelo es demasiado corto.' };
  return { ok: true };
}

/**
 * apiKey puede ir vacío si ya hay clave guardada (hasKey).
 * Si el usuario escribe algo, se valida el formato mínimo.
 */
export function validateApiKeyInput(value: string, hasStoredKey: boolean): FieldResult {
  const v = value.trim();
  if (!v) {
    if (hasStoredKey) return { ok: true };
    return { ok: false, message: 'Pegue una API key o guarde una previamente.' };
  }
  if (v.length < 8) return { ok: false, message: 'La API key parece demasiado corta.' };
  return { ok: true };
}

export function validateAiConfig(input: {
  baseUrl: string;
  model: string;
  apiKey: string;
  hasStoredKey: boolean;
}): ConfigValidation {
  const fields: ConfigValidation['fields'] = {
    baseUrl: validateBaseUrl(input.baseUrl),
    model: validateModel(input.model),
    apiKey: validateApiKeyInput(input.apiKey, input.hasStoredKey),
  };

  const order: ConfigField[] = ['baseUrl', 'model', 'apiKey'];
  let firstError: string | null = null;
  for (const k of order) {
    if (!fields[k].ok) {
      firstError = fields[k].message || 'Revise el formulario.';
      break;
    }
  }

  return {
    ok: !firstError,
    fields,
    firstError,
  };
}
