/** Evalúa expresiones matemáticas simples en español (voz). */
function tryLocalMath(raw) {
  const t = String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/,/g, '.')
    .trim();

  let m = t.match(/\b(?:raiz(?:\s+cuadrada)?(?:\s+de)?|sqrt)\s*(\d+(?:\.\d+)?)\b/);
  if (m) {
    const n = parseFloat(m[1]);
    if (!Number.isFinite(n) || n < 0) return 'No puedo calcular la raíz de un número negativo.';
    const r = Math.sqrt(n);
    const shown = Number.isInteger(r) ? String(r) : r.toFixed(4).replace(/\.?0+$/, '');
    return `La raíz cuadrada de ${n} es ${shown}.`;
  }

  m = t.match(/\b(\d+(?:\.\d+)?)\s*(?:al\s+)?cuadrado\b/);
  if (m) {
    const n = parseFloat(m[1]);
    return `${n} al cuadrado es ${n * n}.`;
  }
  m = t.match(/\b(\d+(?:\.\d+)?)\s*(?:al\s+)?cubo\b/);
  if (m) {
    const n = parseFloat(m[1]);
    return `${n} al cubo es ${n * n * n}.`;
  }

  m = t.match(
    /(?:cuanto\s+es|cuánto\s+es|calcula|calcular|resultado\s+de|cuanto\s+da|cuánto\s+da)\s+(.+)/i,
  );
  let expr = m ? m[1] : null;
  if (!expr) {
    m = t.match(/^(\d+(?:\.\d+)?\s*[\+\-\*\/x×÷]\s*\d+(?:\.\d+)?(?:\s*[\+\-\*\/x×÷]\s*\d+(?:\.\d+)?){0,4})$/);
    if (m) expr = m[1];
  }
  if (expr) {
    let e = expr
      .replace(/\s+/g, '')
      .replace(/[x×]/gi, '*')
      .replace(/÷/g, '/')
      .replace(/[^0-9+\-*/().]/g, '');
    if (!e || !/^[0-9+\-*/().]+$/.test(e)) return null;
    if (e.length > 60) return null;
    try {
      const val = Function('"use strict"; return (' + e + ');')();
      if (typeof val !== 'number' || !Number.isFinite(val)) return null;
      const shown = Number.isInteger(val) ? String(val) : Math.round(val * 10000) / 10000;
      return 'El resultado es ' + shown + '.';
    } catch {
      return null;
    }
  }
  return null;
}

module.exports = { tryLocalMath };
