/**
 * Colores unificados por faccion · Fundacion Aegis-Meridian
 * Director / mando alto = tono oscuro
 * Resto de la faccion = mismo tono, mas claro
 */

const PALETA_FACCION = {
  fundacion: '#8B6914',
  direcciones: '#2F3A9E',
  moderacion: '#A84810',
  soporte: '#1F6B3A',
  cupula: '#4A4499',
  seguridad_interna: '#3D3880',
  seguridad: '#1E5A96',
  medicina: '#1F6B3A',
  investigacion: '#2F3A9E',
  inteligencia: '#4A4499',
  clase_d: '#555550',
  insurgencia: '#9B2E2D',
};

function clavePaletaCargo(cargo, ramaKey) {
  const k = String(cargo.key || '');
  if (k === 'SI.GERENTE' || k.startsWith('SI.')) return 'seguridad_interna';
  if (k === 'SEG.COMANDANTE' || k.startsWith('SEG.')) return 'seguridad';
  if (k === 'MED.DIRECTOR' || k.startsWith('MED.')) return 'medicina';
  if (k === 'INV.DIRECTOR' || k.startsWith('INV.')) return 'investigacion';
  if (k === 'INT.GERENTE' || k.startsWith('INT.')) return 'inteligencia';
  if (k === 'DIR.GENERAL') return 'direcciones';
  if (k.startsWith('ST.ADMIN') || String(ramaKey) === 'moderacion') return 'moderacion';
  if (k.startsWith('ST.')) return 'fundacion';
  if (k.startsWith('SP.')) return 'soporte';
  if (k.startsWith('CUP.')) return 'cupula';
  if (k.startsWith('CD.')) return 'clase_d';
  if (k.startsWith('CAOS.')) return 'insurgencia';
  return ramaKey || 'clase_d';
}

function parseHexColor(hex) {
  const h = String(hex || '#888780').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return { r: 136, g: 135, b: 128 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHexColor(r, g, b) {
  const clamp = (x) => Math.max(0, Math.min(255, Math.round(x)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  );
}

function colorPorNivelMando(hexBase, nivelMando) {
  const { r, g, b } = parseHexColor(hexBase);
  const nivel = Number(nivelMando) || 3;
  const t =
    nivel <= 1 ? 0 :
    nivel === 2 ? 0.18 :
    nivel === 3 ? 0.34 :
    0.50;
  return toHexColor(
    r + (255 - r) * t,
    g + (255 - g) * t,
    b + (255 - b) * t,
  );
}

function colorCargo(cargo, ramaKey) {
  const clave = clavePaletaCargo(cargo, ramaKey);
  const base = PALETA_FACCION[clave] || PALETA_FACCION.clase_d;
  return colorPorNivelMando(base, cargo.nivelMando);
}

/**
 * Parchea exports del organigrama: cada cargo y area con color de faccion.
 */
function aplicar(mod) {
  if (!mod || !mod.ORGANIGRAMA) return mod;

  mod.PALETA_FACCION = PALETA_FACCION;
  mod.colorPorNivelMando = colorPorNivelMando;
  mod.colorCargo = colorCargo;

  const originalGetTodos = mod.getTodosCargos;
  mod.getTodosCargos = function getTodosCargosColoreados() {
    const lista = originalGetTodos();
    return lista.map((c) => {
      const color = colorCargo(c, c.rama);
      return {
        ...c,
        color,
        colorBase: PALETA_FACCION[clavePaletaCargo(c, c.rama)] || c.color,
      };
    });
  };

  if (Array.isArray(mod.ROLES_AREA)) {
    for (const a of mod.ROLES_AREA) {
      const key = String(a.key || '').replace(/^AREA\./, '');
      if (PALETA_FACCION[key]) a.color = PALETA_FACCION[key];
    }
  }

  if (Array.isArray(mod.ROLES_PERMISOS)) {
    const mapa = {
      'PERM.N0': '#6B6B63',
      'PERM.N1': '#1E5A96',
      'PERM.N2': '#378ADD',
      'PERM.N3': '#8B6914',
      'PERM.N4': '#A84810',
      'PERM.N5': '#3D3880',
      'PERM.VERIFICADO': '#1F6B3A',
      'PERM.MIEMBRO': '#2D8A4E',
      'PERM.SUSPENDIDO': '#9B2E2D',
      'PERM.VISITANTE': '#6B6B63',
    };
    for (const p of mod.ROLES_PERMISOS) {
      if (mapa[p.key]) p.color = mapa[p.key];
    }
  }

  return mod;
}

module.exports = {
  PALETA_FACCION,
  colorPorNivelMando,
  colorCargo,
  clavePaletaCargo,
  aplicar,
};
