# ELYRA — Development

## Branch policy

- Integration branch: `main`
- User workflow: `git pull origin main` then run the app
- Keep `main` runnable; prefer small, tested commits

## Local run

```bash
npm install
pip install edge-tts
npm run dev:electron
```

Optional local LLM:

```bash
ollama pull llama3.2
```

## Config

`%USERPROFILE%\.elyra\config.json` (Windows) or `~/.elyra/config.json`

```json
{
  "apiKey": "",
  "baseUrl": "https://api.groq.com/openai/v1",
  "model": "llama-3.3-70b-versatile",
  "searchCacheTtlHours": 6
}
```

Empty `apiKey` → local-intelligence + web search still work.

## Smoke integrity (Node)

From repo root, with Node resolving `electron/` modules:

```bash
node -e "console.log(JSON.stringify(require('./electron/smoke-integrity.cjs').runSmokeIntegrity(),null,2))"
```

Expect `ok: true`.

## Phase rule

Each platform phase: analyze → plan → implement → smoke → commit → push → report.
