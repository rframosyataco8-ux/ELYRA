/**
 * ELYRA versioning — fuente única de verdad de versión de plataforma
 */
module.exports = {
  name: 'ELYRA',
  /** Versión de producto (package.json alineada) */
  product: '2.0.0',
  /** Versión de plataforma IA según roadmap de auditoría */
  platform: '0.1.0',
  codename: 'Foundation',
  phase: '0.1',
  label: 'ELYRA 0.1 — Foundation',
  releasedAt: '2026-08-08',
  capabilities: {
    conversation: true,
    voice: true,
    pcControl: true,
    webSearch: true,
    localIntelligence: true,
    memoryBasic: true,
    tools: true,
    agent: true,
    rag: false,
    vision: false,
    multiAgent: false,
    formalEval: false,
    trainingPipeline: false,
  },
};
