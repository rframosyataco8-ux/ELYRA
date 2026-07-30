/**
 * Puente unificado PC control + extras
 */
const base = require('./pc-control.cjs');
const extra = require('./pc-control-extra.cjs');

module.exports = {
  ...base,
  ...extra,
  async runExtra(name, params = {}) {
    switch (name) {
      case 'task_manager':
      case 'open_task_manager':
        return extra.openTaskManager();
      case 'explorer':
      case 'open_explorer':
        return extra.openExplorer(params.target || params.path);
      case 'flush_dns':
        return extra.flushDns();
      case 'wifi_status':
        return extra.wifiStatus();
      case 'wifi_on':
        return extra.setWifi(true);
      case 'wifi_off':
        return extra.setWifi(false);
      case 'list_windows':
        return extra.listWindows();
      case 'empty_temp':
        return extra.emptyTemp();
      default:
        return { ok: false, result: 'Extra desconocida: ' + name };
    }
  },
};
