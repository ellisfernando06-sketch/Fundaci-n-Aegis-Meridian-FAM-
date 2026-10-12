      { key: 'SEG.ERR', nombre: 'Agente de Respuesta Rapida', orden: 131, nivelMando: 4, aliases: ['agente de respuesta rapida', 'agente err', 'err'] },
      { key: 'SEG.FTM', nombre: 'Operativo FTM', orden: 132, nivelMando: 4, aliases: ['operativo ftm', 'ftm', 'fuerza de trabajo movil'] },
      { key: 'SEG.GUARDIA', nombre: 'Guardia de Seguridad', orden: 133, nivelMando: 4, aliases: ['guardia de seguridad', 'guardia'] },
    ],
  },

  medicina: {
    prefijo: 'MED',
    color: '#3BA55D',
    nombre: 'Medicina',
    cargos: [
      { key: 'MED.JEFE', nombre: 'Jefe de Medicina', orden: 181, nivelMando: 3, aliases: ['jefe de medicina', 'jefe medico'] },
      { key: 'MED.SUPERVISOR', nombre: 'Supervisor Medico', orden: 182, nivelMando: 3, aliases: ['supervisor medico', 'supervisor médico'] },
      { key: 'MED.MEDICO', nombre: 'Medico', orden: 183, nivelMando: 4, aliases: ['medico', 'médico'] },
      { key: 'MED.ENFERMERO', nombre: 'Enfermero', orden: 184, nivelMando: 4, aliases: ['enfermero', 'enfermera'] },
      { key: 'MED.RESIDENTE', nombre: 'Residente', orden: 185, nivelMando: 4, aliases: ['residente'] },
      { key: 'MED.INGRESO', nombre: 'Medico en Ingreso', orden: 186, nivelMando: 4, aliases: ['medico en ingreso', 'médico en ingreso'] },
    ],
  },

  investigacion: {
    prefijo: 'INV',
    color: '#5865F2',
    nombre: 'Investigacion',
    cargos: [
      { key: 'INV.JEFE', nombre: 'Jefe de Investigacion', orden: 221, nivelMando: 3, aliases: ['jefe de investigacion', 'jefe de investigación'] },
      { key: 'INV.SUPERVISOR', nombre: 'Supervisor de Investigacion', orden: 222, nivelMando: 3, aliases: ['supervisor de investigacion', 'supervisor de investigación'] },
      { key: 'INV.CIENTIFICO', nombre: 'Cientifico', orden: 223, nivelMando: 4, aliases: ['cientifico', 'científico'] },
      { key: 'INV.INVESTIGADOR', nombre: 'Investigador', orden: 224, nivelMando: 4, aliases: ['investigador'] },
      { key: 'INV.ASISTENTE', nombre: 'Asistente de Investigacion', orden: 225, nivelMando: 4, aliases: ['asistente de investigacion', 'asistente de investigación'] },
      { key: 'INV.INGRESO', nombre: 'Investigador en Ingreso', orden: 226, nivelMando: 4, aliases: ['investigador en ingreso'] },
    ],
  },

  inteligencia: {
    prefijo: 'INT',
    color: '#7F77DD',
    nombre: 'Inteligencia',
    cargos: [
      { key: 'INT.SUPERVISOR', nombre: 'Supervisor de Inteligencia', orden: 261, nivelMando: 3, aliases: ['supervisor de inteligencia'] },
      { key: 'INT.AGENTE_SENIOR', nombre: 'Agente Senior de Inteligencia', orden: 262, nivelMando: 4, aliases: ['agente senior de inteligencia', 'agente sénior de inteligencia'] },
      { key: 'INT.AGENTE_CAMPO', nombre: 'Agente de Campo de Inteligencia', orden: 263, nivelMando: 4, aliases: ['agente de campo de inteligencia'] },
      { key: 'INT.INGRESO', nombre: 'Agente de Ingreso de Inteligencia', orden: 264, nivelMando: 4, aliases: ['agente de ingreso de inteligencia'] },
    ],
  },

  clase_d: {
    prefijo: 'CD',
    color: '#888780',
    nombre: 'Clase D',
    cargos: [
      { key: 'CD.VETERANO', nombre: 'Clase D Veterano', orden: 301, nivelMando: 4, aliases: ['clase d veterano'] },
      { key: 'CD.AVANZADO', nombre: 'Clase D Avanzado', orden: 302, nivelMando: 4, aliases: ['clase d avanzado'] },
      { key: 'CD.ADEPTO', nombre: 'Clase D Adepto', orden: 303, nivelMando: 4, aliases: ['clase d adepto'] },
      { key: 'CD.DEDICADO', nombre: 'Clase D Dedicado', orden: 304, nivelMando: 4, aliases: ['clase d dedicado'] },
      { key: 'CD.BASE', nombre: 'Clase D', orden: 305, nivelMando: 4, aliases: ['clase d'] },
    ],
  },

  insurgencia: {
    prefijo: 'CAOS',
    color: '#E24B4A',
    nombre: 'Insurgencia del Caos',
    cargos: [
      { key: 'CAOS.MANDO', nombre: 'Mando de la Insurgencia', orden: 341, nivelMando: 2, aliases: ['mando de la insurgencia'] },
      { key: 'CAOS.GAMMA', nombre: 'Mando Gamma', orden: 342, nivelMando: 3, aliases: ['mando gamma'] },
      { key: 'CAOS.DELTA', nombre: 'Mando Delta', orden: 343, nivelMando: 3, aliases: ['mando delta'] },
      { key: 'CAOS.CELULA', nombre: 'Director de Celula', orden: 344, nivelMando: 3, aliases: ['director de celula', 'director de célula'] },
      { key: 'CAOS.AGENTE', nombre: 'Agente de Celula', orden: 345, nivelMando: 4, aliases: ['agente de celula', 'agente de célula'] },
      { key: 'CAOS.OPERATIVO_DELTA', nombre: 'Operativo Delta', orden: 346, nivelMando: 4, aliases: ['operativo delta'] },
      { key: 'CAOS.OPERATIVO_BETA', nombre: 'Operativo Beta', orden: 347, nivelMando: 4, aliases: ['operativo beta'] },
      { key: 'CAOS.OPERATIVO_ALFA', nombre: 'Operativo Alfa', orden: 348, nivelMando: 4, aliases: ['operativo alfa'] },
      { key: 'CAOS.CONSCRIPTO', nombre: 'Conscripto', orden: 349, nivelMando: 4, aliases: ['conscripto'] },
    ],
  },
};

const ROLES_PERMISOS = [
  { key: 'PERM.N0', nombreRol: 'Nivel 0 · Publico', orden: 381, color: '#888780', aliases: ['nivel 0', 'nivel 0 publico'] },
  { key: 'PERM.N1', nombreRol: 'Nivel 1 · Confidencial', orden: 382, color: '#378ADD', aliases: ['nivel 1', 'nivel 1 confidencial'] },
  { key: 'PERM.N2', nombreRol: 'Nivel 2 · Restringido', orden: 383, color: '#378ADD', aliases: ['nivel 2', 'nivel 2 restringido'] },
  { key: 'PERM.N3', nombreRol: 'Nivel 3 · Secreto', orden: 384, color: '#BA7517', aliases: ['nivel 3', 'nivel 3 secreto'] },
  { key: 'PERM.N4', nombreRol: 'Nivel 4 · Alto Secreto', orden: 385, color: '#E67E22', aliases: ['nivel 4', 'nivel 4 alto secreto'] },
  { key: 'PERM.N5', nombreRol: 'Nivel 5 · Meridiano', orden: 386, color: '#7F77DD', aliases: ['nivel 5', 'nivel 5 meridiano'] },
  { key: 'PERM.VERIFICADO', nombreRol: 'Verificado en Roblox', orden: 387, color: '#3BA55D', aliases: ['verificado en roblox', 'verificado'] },
  { key: 'PERM.MIEMBRO', nombreRol: 'Miembro', orden: 388, color: '#3BA55D', aliases: ['miembro', 'member'] },
  { key: 'PERM.SUSPENDIDO', nombreRol: 'Suspendido', orden: 389, color: '#E24B4A', aliases: ['suspendido'] },
  { key: 'PERM.VISITANTE', nombreRol: 'Visitante', orden: 390, color: '#888780', aliases: ['visitante'] },
];

/** Roles de area (se reflejan al asignar area) */
const ROLES_AREA = [
  { key: 'AREA.fundacion', nombreRol: 'Area · Fundacion', orden: 391, color: '#F0B232' },
  { key: 'AREA.direcciones', nombreRol: 'Area · Direcciones', orden: 392, color: '#5865F2' },
  { key: 'AREA.moderacion', nombreRol: 'Area · Moderacion', orden: 393, color: '#E67E22' },
  { key: 'AREA.soporte', nombreRol: 'Area · Soporte', orden: 394, color: '#3BA55D' },
  { key: 'AREA.cupula', nombreRol: 'Area · Cupula', orden: 395, color: '#7F77DD' },
  { key: 'AREA.seguridad_interna', nombreRol: 'Area · Seguridad Interna', orden: 396, color: '#7F77DD' },
  { key: 'AREA.seguridad', nombreRol: 'Area · Seguridad', orden: 397, color: '#378ADD' },
  { key: 'AREA.medicina', nombreRol: 'Area · Medicina', orden: 398, color: '#3BA55D' },
  { key: 'AREA.investigacion', nombreRol: 'Area · Investigacion', orden: 399, color: '#5865F2' },
  { key: 'AREA.inteligencia', nombreRol: 'Area · Inteligencia', orden: 400, color: '#7F77DD' },
  { key: 'AREA.clase_d', nombreRol: 'Area · Clase D', orden: 401, color: '#888780' },
];

/** Roles de llave (categoria KEYS) · se crean con /config_roles o /config_llaves */
function construirRolesLlaves() {
  let lista = [];
  try {
    const { LLAVES_INICIALES } = require('./llaves');
    lista = LLAVES_INICIALES || [];
  } catch (_) {
    lista = [];
  }
  return lista.map((l, i) => ({
    key: l.id,
    nombreRol: `[KEY] ${l.nombre}`,
    orden: 420 + i,
    color: '#D4A017',
    aliases: [
      String(l.nombre || '').toLowerCase(),
      String(l.id || '').toLowerCase(),
      `llave ${String(l.nombre || '').toLowerCase()}`,
    ],
    tipo: 'llave',
    llaveId: l.id,
  }));
}

const ROLES_LLAVES = construirRolesLlaves();

const ROLES_IGNORAR = ['bot oficial', 'bots', 'bot', '@everyone'];

const ROLES_APOYO = {
  areas: ROLES_AREA.map((a) => a.nombreRol),
  autorizacion: ROLES_PERMISOS.filter((p) => p.key.startsWith('PERM.N')).map((p) => p.nombreRol),
  estado: ['Verificado en Roblox', 'Miembro', 'Suspendido', 'Visitante'],
  administracion: [],
};

const SITIOS_DEFAULT = [
  'Sitio Meridiano', 'Sitio Alfa-7', 'Sitio Beta-12',
  'Sitio Gamma-3', 'Sitio Delta-9', 'Sitio Omega-1',
];

const CLASES_CONTENCION_DEFAULT = [
  { nombre: 'Seguro', accesoSugerido: 2 },
  { nombre: 'Euclid', accesoSugerido: 3 },
  { nombre: 'Keter', accesoSugerido: 4 },
  { nombre: 'Thaumiel', accesoSugerido: 5 },
  { nombre: 'Apollyon', accesoSugerido: 5 },
];

const ALERTAS = [
  { codigo: 'Verde', color: '#2E9E5B', emoji: '🟢' },
  { codigo: 'Amarillo', color: '#E8B923', emoji: '🟡' },
  { codigo: 'Naranja', color: '#E67E22', emoji: '🟠' },
  { codigo: 'Rojo', color: '#E24B4A', emoji: '🔴' },
  { codigo: 'Negro', color: '#1A1A1A', emoji: '⚫' },
];

function formatoRol(prefijo, nombreCargo, emoji) {
  if (emoji) return FORMATO_EMOJI(emoji, prefijo, nombreCargo);
  return FORMATO(prefijo, nombreCargo);
}

function getTodosCargos() {
  const lista = [];
  for (const [ramaKey, rama] of Object.entries(ORGANIGRAMA)) {
    for (const cargo of rama.cargos) {
      lista.push({
        ...cargo,
        rama: ramaKey,
        prefijo: rama.prefijo,
        color: rama.color,
        nombreRama: rama.nombre,
        nombreRol: formatoRol(rama.prefijo, cargo.nombre, cargo.emoji || null),
        tipo: 'cargo',
      });
    }
  }
  return lista;
}

function getJerarquiaCompleta() {
  const items = [];
  for (const sep of SEPARADORES) items.push({ ...sep, tipo: 'separador', nombreRol: sep.nombreRol });
  for (const c of getTodosCargos()) items.push(c);
  for (const p of ROLES_PERMISOS) items.push({ ...p, tipo: 'permiso', prefijo: null });
  for (const a of ROLES_AREA) items.push({ ...a, tipo: 'area', prefijo: 'AREA' });
  for (const k of ROLES_LLAVES) items.push({ ...k, tipo: 'llave', prefijo: 'KEY' });
  items.sort((a, b) => (a.orden || 999) - (b.orden || 999));
  return items;
}

function getOrganigramaTexto() {
  const lineas = [];
  const items = getJerarquiaCompleta().filter((i) => i.tipo !== 'permiso' && i.tipo !== 'llave' && i.tipo !== 'area');
  for (const item of items) {
    if (item.tipo === 'separador') {
      lineas.push(`\n**${item.nombreRol}**`);
    } else {
      lineas.push(`· ${item.nombreRol}`);
    }
  }
  return lineas.join('\n').trim();
}

function getCargoPorKey(key) {
  return getTodosCargos().find((c) => c.key === key) || null;
}

function getPosicionCargo(key) {
  for (const rama of Object.values(ORGANIGRAMA)) {
    const idx = rama.cargos.findIndex((c) => c.key === key);
    if (idx !== -1) return idx;
  }
  return -1;
}

function nombreBaseRol(nombreDiscord) {
  return String(nombreDiscord || '')
    .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/u, '')
    .replace(/^[A-Z0-9]{1,6}\s*●┇\s*/i, '')
    .replace(/^[A-Z0-9]{1,6}\s*[|｜¦]\s*/i, '')
    .replace(/^[A-Z0-9]{1,6}\s*[-–—:]\s*/i, '')
    .replace(/^\[[A-Z0-9]{1,6}\]\s*/i, '')
    .replace(/^—+\s*/u, '')
    .replace(/\s*—+$/u, '')
    .replace(/^━+\s*/u, '')
    .replace(/\s*━+$/u, '')
    .trim();
}

module.exports = {
  ORGANIGRAMA,
  SEPARADORES,
  ROLES_PERMISOS,
  ROLES_LLAVES,
  ROLES_AREA,
  ROLES_IGNORAR,
  ROLES_APOYO,
  SITIOS_DEFAULT,
  CLASES_CONTENCION_DEFAULT,
  ALERTAS,
  formatoRol,
  getTodosCargos,
  getJerarquiaCompleta,
  getOrganigramaTexto,
  getCargoPorKey,
  getPosicionCargo,
  nombreBaseRol,
};
