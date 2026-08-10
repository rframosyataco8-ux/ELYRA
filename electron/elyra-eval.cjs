/**
 * ELYRA_EVAL 0.9 — evaluación offline (sin APIs de pago)
 * Comprueba módulos, permisos, rutas, versión y contratos básicos.
 * Ejecutar: node -e "console.log(JSON.stringify(require('./electron/elyra-eval.cjs').runEval(),null,2))"
 */

function assert(cond, name, detail) {
  return { name, ok: !!cond, detail: detail || (cond ? 'ok' : 'fail') };
}

function runEval() {
  const tests = [];
  const started = Date.now();

  // Version
  try {
    const v = require('./elyra-version.cjs');
    tests.push(assert(v && v.platform, 'version.platform', v && v.platform));
    tests.push(assert(v.name === 'ELYRA', 'version.name', v.name));
    tests.push(assert(v.capabilities && v.capabilities.vision === true, 'capability.vision'));
    tests.push(assert(v.capabilities && v.capabilities.rag === true, 'capability.rag'));
  } catch (e) {
    tests.push(assert(false, 'version.load', e.message));
  }

  // Smoke modules
  try {
    const smoke = require('./smoke-integrity.cjs').runSmokeIntegrity();
    tests.push(assert(smoke.ok, 'smoke.integrity', smoke.failed + ' failed'));
    tests.push(assert(smoke.passed >= 15, 'smoke.moduleCount', String(smoke.passed)));
  } catch (e) {
    tests.push(assert(false, 'smoke.load', e.message));
  }

  // Permissions
  try {
    const perm = require('./tool-permissions.cjs');
    const blockRm = perm.checkShellCommand('rm -rf /');
    tests.push(assert(!blockRm.ok && blockRm.blocked, 'security.block_rm_rf'));
    const blockFormat = perm.checkShellCommand('format C:');
    tests.push(assert(!blockFormat.ok, 'security.block_format'));
    const allowDir = perm.checkShellCommand('dir');
    tests.push(assert(allowDir.ok, 'security.allow_dir'));
    const power = perm.authorizeTool('power', { action: 'shutdown' }, { userText: 'apaga el pc' });
    tests.push(assert(!power.ok && power.needsConfirm, 'security.power_needs_confirm'));
    const powerOk = perm.authorizeTool('power', { action: 'shutdown' }, { userText: 'confirma apagar' });
    tests.push(assert(powerOk.ok, 'security.power_with_confirm'));
    const killCrit = perm.authorizeTool('kill_process', { name: 'explorer' }, { userText: 'confirma' });
    tests.push(assert(!killCrit.ok, 'security.block_critical_process'));
  } catch (e) {
    tests.push(assert(false, 'permissions', e.message));
  }

  // Path helpers
  try {
    const files = require('./files-reliability.cjs');
    const roots = files.userRoots();
    tests.push(assert(!!roots.docs, 'files.docs_root', roots.docs));
    tests.push(assert(typeof files.resolveUserFile === 'function', 'files.resolveUserFile'));
  } catch (e) {
    tests.push(assert(false, 'files.reliability', e.message));
  }

  // Memory
  try {
    const mem = require('./memory-cognitive.cjs');
    tests.push(assert(typeof mem.buildContextSnippet === 'function', 'memory.snippet'));
    tests.push(assert(typeof mem.addFact === 'function', 'memory.addFact'));
  } catch (e) {
    tests.push(assert(false, 'memory', e.message));
  }

  // RAG
  try {
    const rag = require('./rag-local.cjs');
    tests.push(assert(typeof rag.searchDocs === 'function', 'rag.search'));
    tests.push(assert(typeof rag.buildIndex === 'function', 'rag.index'));
    tests.push(assert(rag.looksLikeDocQuery('según mis informes de cadmio'), 'rag.detect_query'));
  } catch (e) {
    tests.push(assert(false, 'rag', e.message));
  }

  // Vision module load (no API call)
  try {
    const vision = require('./vision-engine.cjs');
    tests.push(assert(typeof vision.analyzeImage === 'function', 'vision.analyzeImage'));
    tests.push(assert(typeof vision.pickVisionModel === 'function', 'vision.pickModel'));
  } catch (e) {
    tests.push(assert(false, 'vision', e.message));
  }

  // TTS prepare
  try {
    const tts = require('./tts.cjs');
    const p = tts.prepareForSpeech('Listo. CPU al 45%.');
    tests.push(assert(!!p.text, 'tts.prepare', p.text.slice(0, 40)));
  } catch (e) {
    tests.push(assert(false, 'tts', e.message));
  }

  // Security redact
  try {
    const sec = require('./security-harden.cjs');
    const red = sec.redactSecrets('key gsk_abcdefghijklmnop and sk-1234567890123456789012');
    tests.push(assert(!/gsk_[a-z]{10}/i.test(red), 'security.redact_gsk'));
    tests.push(assert(sec.isPathSafe(require('path').join(require('os').homedir(), 'Documents', 'a.txt')), 'security.path_safe_home'));
    tests.push(assert(!sec.isPathSafe('C:\\Windows\\System32\\config'), 'security.path_block_system'));
  } catch (e) {
    tests.push(assert(false, 'security.harden', e.message));
  }

  const passed = tests.filter((t) => t.ok).length;
  const failed = tests.filter((t) => !t.ok);

  return {
    ok: failed.length === 0,
    suite: 'ELYRA_EVAL',
    version: (() => {
      try {
        return require('./elyra-version.cjs').platform;
      } catch {
        return null;
      }
    })(),
    passed,
    failed: failed.length,
    total: tests.length,
    durationMs: Date.now() - started,
    failures: failed,
    tests,
    at: new Date().toISOString(),
  };
}

module.exports = { runEval };
