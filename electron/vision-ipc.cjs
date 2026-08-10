/** IPC helpers visión/OCR 1.4 — registrar en main */
const { getConfig } = require('./agent.cjs');
const ocr = require('./ocr-engine.cjs');

function registerVisionIpc(ipcMain) {
  ipcMain.handle('vision-pick-analyze', async (_e, payload) => {
    try {
      return await ocr.pickAndAnalyze((payload && payload.prompt) || null, getConfig);
    } catch (err) {
      return { ok: false, result: err.message || String(err) };
    }
  });
  ipcMain.handle('vision-analyze-path', async (_e, payload) => {
    try {
      return await ocr.analyzePath(
        payload && payload.path,
        (payload && payload.prompt) || null,
        getConfig,
      );
    } catch (err) {
      return { ok: false, result: err.message || String(err) };
    }
  });
}

module.exports = { registerVisionIpc };
