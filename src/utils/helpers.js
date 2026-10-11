/**
 * Utilidades generales de la Fundación Aegis-Meridian
 */

/**
 * Escapa caracteres de Markdown peligrosos y menciones.
 */
function sanitizar(texto) {
  if (!texto) return '';
  return String(texto)
    .replace(/[`*_~|>]/g, '\\$&')
    .replace(/@everyone/gi, '@\u200beveryone')
    .replace(/@here/gi, '@\u200bhere');
}

/**
 * Normaliza un nombre de rol para comparación (minúsculas, sin tildes, sin corchetes).
 */
function normalizarNombre(nombre) {
  return String(nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Similitud de Dice entre dos cadenas (0 a 1).
 */
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

/**
 * Trunca texto al límite de un campo de embed (1024).
 */
function truncar(texto, max = 1024) {
  const t = String(texto || '');
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

module.exports = {
  sanitizar,
  normalizarNombre,
  similitudDice,
  truncar,
};
