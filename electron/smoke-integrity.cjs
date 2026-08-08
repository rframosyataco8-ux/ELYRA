/**
 * Smoke de integridad ELYRA — comprueba que módulos críticos cargan
 * No ejecuta acciones destructivas ni llama a APIs de pago.
 */
function tryRequire(rel) {
  try {
    require(rel);
    return { ok: true, module: rel };
  } catch (err) {
    return { ok: false, module: rel, error: String(err.message || err).slice(0, 200) };
  }
}

function runSmokeIntegrity() {
  const critical = [
    './elyra-version.cjs',
    './agent-prompt.cjs',
    './agent.cjs',
    './agent-hooks.cjs',
    './chat-router.cjs',
    './tool-executor.cjs',
    './tools-schema.cjs',
    './pc-control.cjs',
    './tts.cjs',
    './stt.cjs',
    './web-search-boost.cjs',
    './smart-knowledge.cjs',
    './search-cache.cjs',
    './local-intelligence.cjs',
    './local-math.cjs',
    './memory-cognitive.cjs',
    './intent-compound.cjs',
  ];

  const results = critical.map(tryRequire);
  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);

  let version = null;
  try {
    version = require('./elyra-version.cjs');
  } catch {}

  return {
    ok: failed.length === 0,
    passed: passed.length,
    failed: failed.length,
    failures: failed,
    version: version
      ? { platform: version.platform, product: version.product, label: version.label }
      : null,
    at: new Date().toISOString(),
  };
}

module.exports = { runSmokeIntegrity };
