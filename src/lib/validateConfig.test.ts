import { describe, it, expect } from 'vitest';
import {
  validateBaseUrl,
  validateModel,
  validateApiKeyInput,
  validateAiConfig,
} from './validateConfig';

describe('validateBaseUrl', () => {
  it('rechaza vacío', () => {
    expect(validateBaseUrl('').ok).toBe(false);
    expect(validateBaseUrl('   ').ok).toBe(false);
  });

  it('rechaza URL inválida', () => {
    expect(validateBaseUrl('not-a-url').ok).toBe(false);
    expect(validateBaseUrl('ftp://x.com').ok).toBe(false);
  });

  it('acepta https válido', () => {
    expect(validateBaseUrl('https://api.groq.com/openai/v1').ok).toBe(true);
  });
});

describe('validateModel', () => {
  it('rechaza vacío o muy corto', () => {
    expect(validateModel('').ok).toBe(false);
    expect(validateModel('a').ok).toBe(false);
  });

  it('acepta nombre de modelo', () => {
    expect(validateModel('llama-3.1-8b-instant').ok).toBe(true);
  });
});

describe('validateApiKeyInput', () => {
  it('permite vacío si hay clave guardada', () => {
    expect(validateApiKeyInput('', true).ok).toBe(true);
  });

  it('exige clave si no hay guardada', () => {
    expect(validateApiKeyInput('', false).ok).toBe(false);
  });

  it('rechaza clave demasiado corta', () => {
    expect(validateApiKeyInput('abc', false).ok).toBe(false);
  });

  it('acepta clave con longitud mínima', () => {
    expect(validateApiKeyInput('sk-12345678', false).ok).toBe(true);
  });
});

describe('validateAiConfig', () => {
  it('ok con config completa', () => {
    const r = validateAiConfig({
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-test',
      apiKey: 'sk-abcdefgh',
      hasStoredKey: false,
    });
    expect(r.ok).toBe(true);
    expect(r.firstError).toBeNull();
  });

  it('reporta el primer error en orden', () => {
    const r = validateAiConfig({
      baseUrl: '',
      model: '',
      apiKey: '',
      hasStoredKey: false,
    });
    expect(r.ok).toBe(false);
    expect(r.firstError).toMatch(/Base URL/i);
  });

  it('ok sin apiKey nueva si ya hay clave', () => {
    const r = validateAiConfig({
      baseUrl: 'https://api.example.com/v1',
      model: 'm1',
      apiKey: '',
      hasStoredKey: true,
    });
    expect(r.ok).toBe(true);
  });
});
