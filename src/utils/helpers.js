/**
 * Utilidades generales de la Fundacion Aegis-Meridian
 */

function sanitizar(texto) {
  if (!texto) return '';
  return String(texto)
    .replace(/[`*_~|>]/g, '\\$&')
    .replace(/@everyone/gi, '@\u200beveryone')
    .replace(/@here/gi, '@\u200bhere');
}

/**
 * Normaliza nombres de rol para comparacion.
 * Quita tildes, simbolos, unifica variantes comunes.
 */
function normalizarNombre(nombre) {
  return String(nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/co[\s\-]?fundador/g, 'cofundador')
    .replace(/sub[\s\-]?comandante/g, 'subcomandante')
    .replace(/sub[\s\-]?director/g, 'subdirector')
    .replace(/sub[\s\-]?jefe/g, 'subjefe')
    .replace(/sub[\s\-]?gerente/g, 'subgerente')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokens significativos (quita palabras muy cortas / de relleno).
 */
function tokensSignificativos(nombre) {
  const stop = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'a', 'al', 'un', 'una', 'para', 'por']);
  return normalizarNombre(nombre)
    .split(' ')
    .filter((t) => t.length >= 3 && !stop.has(t));
}

/**
 * Proporcion de tokens de `esperado` que aparecen en `candidato`.
 */
function coberturaTokens(esperado, candidato) {
  const te = tokensSignificativos(esperado);
  const tc = new Set(tokensSignificativos(candidato));
  if (!te.length) return 0;
  let ok = 0;
  for (const t of te) {
    if (tc.has(t)) ok++;
    else {
      // coincidencia parcial de token (ej. calidad ≈ calidad)
      for (const c of tc) {
        if (c.includes(t) || t.includes(c)) { ok++; break; }
      }
    }
  }
  return ok / te.length;
}

function similitudDice(a, b) {
  const s1 = normalizarNombre(a);
  const s2 = normalizarNombre(b);
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams = (str) => {
    const set = new Map();
    for (let i = 0; i < str.length - 1; i++) {
      const bg = str.slice(i, i + 2);
      set.set(bg, (set.get(bg) || 0) + 1);
    }
    return set;
  };

  const b1 = bigrams(s1);
  const b2 = bigrams(s2);
  let inter = 0;
  for (const [bg, count] of b1) {
    if (b2.has(bg)) inter += Math.min(count, b2.get(bg));
  }
  return (2 * inter) / (s1.length - 1 + s2.length - 1);
}

function truncar(texto, max = 1024) {
  const t = String(texto || '');
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

module.exports = {
  sanitizar,
  normalizarNombre,
  tokensSignificativos,
  coberturaTokens,
  similitudDice,
  truncar,
};
