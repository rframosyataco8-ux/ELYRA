# Configurar Groq (gratis) en ELYRA — 2 minutos

## Por qué Groq

- **Gratis** (sin tarjeta de crédito)
- Muy **rápido** (ideal para un asistente de voz)
- Modelo potente: **Llama 3.3 70B**
- Compatible al 100% con ELYRA

Límites del plan gratis (suficientes para uso personal):
- ~30 peticiones/minuto
- ~1000 peticiones/día en el modelo 70B

---

## Pasos

### 1. Crear cuenta y API key

1. Abre: https://console.groq.com
2. Regístrate (Google/GitHub o email)
3. En el menú: **API Keys** → **Create API Key**
4. Copia la key (empieza por `gsk_`)

### 2. Crear el archivo de configuración

En el Explorador de archivos, ve a tu usuario y crea la carpeta `.elyra` si no existe.

**Ruta en Windows:**
```
C:\Users\TU_USUARIO\.elyra\config.json
```

**Contenido del archivo `config.json`:**

```json
{
  "apiKey": "gsk_pega_aqui_tu_key",
  "baseUrl": "https://api.groq.com/openai/v1",
  "model": "llama-3.3-70b-versatile"
}
```

### 3. (Opcional) Voz natural

```bash
pip install edge-tts
```

### 4. Arrancar ELYRA

```bash
npm run dev:electron
```

En la barra superior deberías ver **· IA activa**.

---

## Modelos recomendados en Groq (gratis)

| Modelo | Uso |
|--------|-----|
| `llama-3.3-70b-versatile` | **Mejor calidad** (recomendado) |
| `llama-3.1-8b-instant` | Más rápido, más peticiones/día |
| `meta-llama/llama-4-scout-17b-16e-instruct` | Alternativa potente |

---

## Alternativas gratis

### Google Gemini (también gratis)
```json
{
  "apiKey": "tu-gemini-key",
  "baseUrl": "https://generativelanguage.googleapis.com/v1beta/openai",
  "model": "gemini-2.0-flash"
}
```
Key en: https://aistudio.google.com/apikey

### Ollama (100% local, sin internet)
```bash
ollama pull llama3.2
```
```json
{
  "apiKey": "ollama",
  "baseUrl": "http://localhost:11434/v1",
  "model": "llama3.2"
}
```
