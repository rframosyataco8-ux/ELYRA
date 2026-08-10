/**
 * Enganche PC NLU al inicio de tryLocal — importado desde chat-router
 * (evita reescribir todo chat-router.cjs de una vez)
 */
const { tryPcNlu } = require('./pc-nlu.cjs');

async function tryPcFirst(text, helpers, pc, getSystemStats) {
  try {
    return await tryPcNlu(text, helpers, pc, getSystemStats);
  } catch {
    return null;
  }
}

module.exports = { tryPcFirst };
