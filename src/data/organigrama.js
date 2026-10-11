/**
 * Organigrama oficial · Fundación Aegis-Meridian
 * Formato de rol Discord: "XX ●┇Nombre" (ej. "MED ●┇Director Médico")
 * orden: menor número = más alto en la lista de Discord
 */

const FORMATO = (prefijo, nombre) => `${prefijo} ●┇${nombre}`;

/**
 * Separadores visuales (roles sin permisos, solo estética)
 */
const SEPARADORES = [
  { key: 'SEP.STAFF', nombreRol: '━━━━ STAFF ━━━━', orden: 10, color: '#2B2D31' },
  { key: 'SEP.SOPORTE', nombreRol: '━━━━ SOPORTE ━━━━', orden: 40, color: '#2B2D31' },
  { key: 'SEP.CUPULA', nombreRol: '━━━━ CÚPULA ━━━━', orden: 60, color: '#2B2D31' },
  { key: 'SEP.DIRECCIONES', nombreRol: '━━━━ DIRECCIONES ━━━━', orden: 80, color: '#2B2D31' },
  { key: 'SEP.SI', nombreRol: '━━━━ SEGURIDAD INTERNA ━━━━', orden: 110, color: '#2B2D31' },
  { key: 'SEP.SEG', nombreRol: '━━━━ FACCIÓN SEGURIDAD ━━━━', orden: 160, color: '#2B2D31' },
  { key: 'SEP.MED', nombreRol: '━━━━ MEDICINA ━━━━', orden: 220, color: '#2B2D31' },
  { key: 'SEP.INV', nombreRol: '━━━━ INVESTIGACIÓN ━━━━', orden: 260, color: '#2B2D31' },
  { key: 'SEP.INT', nombreRol: '━━━━ INTELIGENCIA ━━━━', orden: 300, color: '#2B2D31' },
  { key: 'SEP.CD', nombreRol: '━━━━ CLASE D ━━━━', orden: 340, color: '#2B2D31' },
  { key: 'SEP.CAOS', nombreRol: '━━━━ INSURGENCIA ━━━━', orden: 380, color: '#2B2D31' },
  { key: 'SEP.PERMISOS', nombreRol: '━━━━ PERMISOS ━━━━', orden: 420, color: '#2B2D31' },
];

/**
 * ORGANIGRAMA por rama.
 * orden global controla la posición al organizar.
 * aliases: nombres alternativos para detectar roles ya existentes en el servidor.
 */
const ORGANIGRAMA = {
  staff: {
    prefijo: 'ST',
    color: '#F0B232',
    nombre: 'Staff',
    cargos: [
      { key: 'ST.FUNDADOR', nombre: 'Fundador', orden: 11, nivelMando: 1, aliases: ['fundador'] },
      { key: 'ST.CO_CALIDAD', nombre: 'Cofundador de Calidad y Cumplimiento', orden: 12, nivelMando: 1, aliases: ['cofundador de calidad y cumplimiento', 'co-fundador de cumplimiento y calidad', 'co fundador de calidad y cumplimiento'] },
      { key: 'ST.CO_ESTRATEGIA', nombre: 'Cofundador de Estrategia y Estatuto', orden: 13, nivelMando: 1, aliases: ['cofundador de estrategia y estatuto', 'co-fundador de estatutos y estrategia', 'co fundador de estrategia y estatuto'] },
      { key: 'ST.ADMIN_JEFE', nombre: 'Administrador en Jefe', orden: 14, nivelMando: 1, aliases: ['administrador en jefe', 'admin en jefe'] },
      { key: 'ST.ADMIN_SENIOR', nombre: 'Administrador Senior', orden: 15, nivelMando: 1, aliases: ['administrador senior', 'admin senior', 'administrador sénior'] },
      { key: 'ST.ADMIN_PRUEBA', nombre: 'Administrador en Prueba', orden: 16, nivelMando: 1, aliases: ['administrador en prueba', 'admin en prueba'] },
    ],
  },
  soporte: {
    prefijo: 'SP',
    color: '#3BA55D',
    nombre: 'Soporte',
    cargos: [
      { key: 'SP.TECNICO', nombre: 'Soporte Técnico', orden: 41, nivelMando: 1, aliases: ['soporte tecnico', 'soporte técnico'] },
      { key: 'SP.TECNICO_PRUEBA', nombre: 'Soporte Técnico en Prueba', orden: 42, nivelMando: 1, aliases: ['soporte tecnico en prueba', 'soporte técnico en prueba'] },
    ],
  },
  cupula: {
    prefijo: 'CUP',
    color: '#7F77DD',
    nombre: 'Cúpula',
    cargos: [
      { key: 'CUP.PRESIDENTE', nombre: 'Presidente del Consejo', orden: 61, nivelMando: 1, aliases: ['presidente del consejo'] },
      { key: 'CUP.CONSEJO', nombre: 'Consejo Directivo', orden: 62, nivelMando: 1, aliases: ['consejo directivo', 'junta de directores'] },
    ],
  },
  direcciones: {
    prefijo: 'DIR',
    color: '#5865F2',
    nombre: 'Direcciones',
    cargos: [
      // Gerente SI va ENCIMA de Director General (solo responde a Fundación / Cofundador Calidad)
      { key: 'SI.GERENTE', nombre: 'Gerente de Seguridad Interna', orden: 81, nivelMando: 2, aliases: ['gerente de seguridad interna', 'gerente se seguridad interna'] },
      { key: 'DIR.GENERAL', nombre: 'Director General', orden: 82, nivelMando: 1, aliases: ['director general'] },
      { key: 'INT.GERENTE', nombre: 'Gerente de Inteligencia', orden: 83, nivelMando: 2, aliases: ['gerente de inteligencia'] },
      { key: 'SEG.COMANDANTE', nombre: 'Comandante de Seguridad', orden: 84, nivelMando: 2, aliases: ['comandante de seguridad', 'comandante'] },
      { key: 'MED.DIRECTOR', nombre: 'Director Médico', orden: 85, nivelMando: 2, aliases: ['director medico', 'director médico'] },
      { key: 'INV.DIRECTOR', nombre: 'Director de Investigación Científica', orden: 86, nivelMando: 2, aliases: ['director de investigacion cientifica', 'director de investigación científica', 'director de investigacion'] },
    ],
  },
  seguridad_interna: {
    prefijo: 'SI',
    color: '#7F77DD',
    nombre: 'Seguridad Interna',
    cargos: [
      { key: 'SI.JEFE', nombre: 'Jefe de Seguridad Interna', orden: 111, nivelMando: 3, aliases: ['jefe de seguridad interna'] },
      { key: 'SI.SUPERVISOR', nombre: 'Supervisor de Seguridad Interna', orden: 112, nivelMando: 3, aliases: ['supervisor de seguridad interna', 'supervisor'] },
      { key: 'SI.INTERROGATORIO', nombre: 'Encargado de Interrogatorio de Seguridad Interna', orden: 113, nivelMando: 3, aliases: ['encargado de interrogatorio de seguridad interna', 'encargado de interrogatorio'] },
      { key: 'SI.AGENTE_CAMPO', nombre: 'Agente de Campo de Seguridad Interna', orden: 114, nivelMando: 4, aliases: ['agente de campo de seguridad interna', 'agente de campo'] },
      { key: 'SI.AGENTE', nombre: 'Agente de Seguridad Interna', orden: 115, nivelMando: 4, aliases: ['agente de seguridad interna'] },
      { key: 'SI.INGRESO', nombre: 'Agente de Ingreso de Seguridad Interna', orden: 116, nivelMando: 4, aliases: ['agente de ingreso de seguridad interna', 'agente de ingreso'] },
    ],
  },
  seguridad: {
    prefijo: 'SEG',
    color: '#378ADD',
    nombre: 'Facción de Seguridad',
    cargos: [
      { key: 'SEG.COMANDANTES', nombre: 'Comandantes de Facciones de Seguridad', orden: 161, nivelMando: 2, aliases: ['comandantes de facciones de seguridad', 'comandante de faccion de seguridad'] },
      { key: 'SEG.SUB_GUARDIA', nombre: 'Subcomandante de Guardia', orden: 162, nivelMando: 3, aliases: ['sub comandante de guardia', 'subcomandante de guardia'] },
      { key: 'SEG.SUB_RR', nombre: 'Subcomandante de Respuesta Rápida', orden: 163, nivelMando: 3, aliases: ['subcomandante de respuesta rapida', 'subcomandante de respuesta rápida', 'sub comandante de respuesta rapida'] },
      { key: 'SEG.SUB_FTM', nombre: 'Subcomandante de Fuerza de Trabajo Móvil', orden: 164, nivelMando: 3, aliases: ['subcomandante de fuerza de trabajo mobil', 'subcomandante de fuerza de trabajo móvil', 'sub comandante de fuerza de trabajo mobil'] },
      { key: 'SEG.CAPITAN', nombre: 'Capitán de Seguridad', orden: 165, nivelMando: 3, aliases: ['capitan de seguridad', 'capitán de seguridad', 'capitan'] },
      { key: 'SEG.TENIENTE', nombre: 'Teniente de Seguridad', orden: 166, nivelMando: 4, aliases: ['teniente de seguridad', 'teniente'] },
      { key: 'SEG.SARGENTO', nombre: 'Sargento de Seguridad', orden: 167, nivelMando: 4, aliases: ['sargento de seguridad', 'sargento'] },
      { key: 'SEG.CABO', nombre: 'Cabo de Seguridad', orden: 168, nivelMando: 4, aliases: ['cabo de seguridad', 'cabo'] },
      { key: 'SEG.SOLDADO', nombre: 'Soldado de Seguridad', orden: 169, nivelMando: 4, aliases: ['soldado de seguridad', 'soldado'] },
      { key: 'SEG.CADETE', nombre: 'Cadete de Seguridad', orden: 170, nivelMando: 4, aliases: ['cadete de seguridad', 'cadete'] },
    ],
  },
  ftm: {
    prefijo: 'FTM',
    color: '#378ADD',
    nombre: 'Fuerza de Trabajo Móvil',
    cargos: [
      { key: 'FTM.JEFE', nombre: 'Jefe de Fuerza de Trabajo Móvil', orden: 180, nivelMando: 2, aliases: ['jefe de fuerza de trabajo mobil', 'jefe de fuerza de tarea'] },
      { key: 'FTM.TENIENTE', nombre: 'Teniente de FTM', orden: 181, nivelMando: 3, aliases: ['teniente de ftm', 'teniente de fuerza de tarea'] },
      { key: 'FTM.SARGENTO', nombre: 'Sargento de FTM', orden: 182, nivelMando: 3, aliases: ['sargento de ftm'] },
      { key: 'FTM.OPERATIVO_ELITE', nombre: 'Operativo de Élite FTM', orden: 183, nivelMando: 3, aliases: ['operativo de elite', 'operativo de élite'] },
      { key: 'FTM.OPERATIVO', nombre: 'Operativo FTM', orden: 184, nivelMando: 4, aliases: ['operativo ftm', 'operativo'] },
      { key: 'FTM.RECLUTA', nombre: 'Recluta FTM', orden: 185, nivelMando: 4, aliases: ['recluta ftm', 'recluta'] },
    ],
  },
  err: {
    prefijo: 'ERR',
    color: '#378ADD',
    nombre: 'Equipo de Respuesta Rápida',
    cargos: [
      { key: 'ERR.JEFE', nombre: 'Jefe del ERR', orden: 190, nivelMando: 2, aliases: ['jefe del err', 'jefe err'] },
      { key: 'ERR.SUBJEFE', nombre: 'Subjefe del ERR', orden: 191, nivelMando: 3, aliases: ['subjefe del err'] },
      { key: 'ERR.LIDER_ESCUADRON', nombre: 'Líder de Escuadrón ERR', orden: 192, nivelMando: 3, aliases: ['lider de escuadron', 'líder de escuadrón'] },
      { key: 'ERR.OPERATIVO', nombre: 'Operativo ERR', orden: 193, nivelMando: 4, aliases: ['operativo err', 'operativo tactico'] },
      { key: 'ERR.RECLUTA', nombre: 'Recluta ERR', orden: 194, nivelMando: 4, aliases: ['recluta err'] },
    ],
  },
  medicina: {
    prefijo: 'MED',
    color: '#1D9E75',
    nombre: 'Medicina',
    cargos: [
      { key: 'MED.SUBDIRECTOR', nombre: 'Subdirector Médico', orden: 221, nivelMando: 3, aliases: ['subdirector medico', 'subdirector médico'] },
      { key: 'MED.ADJUNTO', nombre: 'Médico Adjunto', orden: 222, nivelMando: 3, aliases: ['medico adjunto', 'médico adjunto'] },
      { key: 'MED.ESPECIALISTA', nombre: 'Especialista Clínico', orden: 223, nivelMando: 3, aliases: ['especialista clinico', 'especialista clínico'] },
      { key: 'MED.JEFE_RESIDENTES', nombre: 'Jefe de Residentes', orden: 224, nivelMando: 4, aliases: ['jefe de residentes'] },
      { key: 'MED.RESIDENTE_SENIOR', nombre: 'Residente Senior', orden: 225, nivelMando: 4, aliases: ['residente senior', 'residente sénior'] },
      { key: 'MED.RESIDENTE', nombre: 'Residente', orden: 226, nivelMando: 4, aliases: ['residente'] },
      { key: 'MED.INTERNO', nombre: 'Interno de Medicina', orden: 227, nivelMando: 4, aliases: ['interno de medicina', 'interno'] },
    ],
  },
  investigacion: {
    prefijo: 'INV',
    color: '#1D9E75',
    nombre: 'Investigación',
    cargos: [
      { key: 'INV.SUBDIRECTOR', nombre: 'Subdirector de Investigación', orden: 261, nivelMando: 3, aliases: ['subdirector de investigacion', 'subdirector de investigación'] },
      { key: 'INV.JEFE', nombre: 'Jefe de Investigación', orden: 262, nivelMando: 3, aliases: ['jefe de investigacion', 'jefe de investigación'] },
      { key: 'INV.SENIOR', nombre: 'Investigador Senior', orden: 263, nivelMando: 3, aliases: ['investigador senior', 'investigador sénior'] },
      { key: 'INV.INVESTIGADOR', nombre: 'Investigador', orden: 264, nivelMando: 4, aliases: ['investigador'] },
      { key: 'INV.JUNIOR', nombre: 'Investigador Junior', orden: 265, nivelMando: 4, aliases: ['investigador junior', 'investigador júnior'] },
      { key: 'INV.INTERNO', nombre: 'Interno de Investigación', orden: 266, nivelMando: 4, aliases: ['interno de investigacion', 'interno de investigación'] },
    ],
  },
  inteligencia: {
    prefijo: 'INT',
    color: '#BA7517',
    nombre: 'Inteligencia',
    cargos: [
      { key: 'INT.SUBGERENTE', nombre: 'Subgerente de Inteligencia', orden: 301, nivelMando: 3, aliases: ['subgerente de inteligencia'] },
      { key: 'INT.SUPERVISOR', nombre: 'Supervisor de Inteligencia', orden: 302, nivelMando: 3, aliases: ['supervisor de inteligencia'] },
      { key: 'INT.AGENTE_SENIOR', nombre: 'Agente Senior de Inteligencia', orden: 303, nivelMando: 4, aliases: ['agente senior de inteligencia', 'agente sénior'] },
      { key: 'INT.AGENTE_CAMPO', nombre: 'Agente de Campo de Inteligencia', orden: 304, nivelMando: 4, aliases: ['agente de campo de inteligencia'] },
      { key: 'INT.INGRESO', nombre: 'Agente de Ingreso de Inteligencia', orden: 305, nivelMando: 4, aliases: ['agente de ingreso de inteligencia'] },
    ],
  },
  clase_d: {
    prefijo: 'CD',
    color: '#888780',
    nombre: 'Clase D',
    cargos: [
      { key: 'CD.VETERANO', nombre: 'Clase D Veterano', orden: 341, nivelMando: 4, aliases: ['clase d veterano'] },
      { key: 'CD.AVANZADO', nombre: 'Clase D Avanzado', orden: 342, nivelMando: 4, aliases: ['clase d avanzado'] },
      { key: 'CD.ADEPTO', nombre: 'Clase D Adepto', orden: 343, nivelMando: 4, aliases: ['clase d adepto'] },
      { key: 'CD.DEDICADO', nombre: 'Clase D Dedicado', orden: 344, nivelMando: 4, aliases: ['clase d dedicado'] },
      { key: 'CD.BASE', nombre: 'Clase D', orden: 345, nivelMando: 4, aliases: ['clase d'] },
    ],
  },
  insurgencia: {
    prefijo: 'CAOS',
    color: '#E24B4A',
    nombre: 'Insurgencia del Caos',
    cargos: [
      { key: 'CAOS.MANDO', nombre: 'Mando de la Insurgencia', orden: 381, nivelMando: 2, aliases: ['mando de la insurgencia'] },
      { key: 'CAOS.GAMMA', nombre: 'Mando Gamma', orden: 382, nivelMando: 3, aliases: ['mando gamma'] },
      { key: 'CAOS.DELTA', nombre: 'Mando Delta', orden: 383, nivelMando: 3, aliases: ['mando delta'] },
      { key: 'CAOS.CELULA', nombre: 'Director de Célula', orden: 384, nivelMando: 3, aliases: ['director de celula', 'director de célula'] },
      { key: 'CAOS.AGENTE', nombre: 'Agente de Célula', orden: 385, nivelMando: 4, aliases: ['agente de celula', 'agente de célula'] },
      { key: 'CAOS.OPERATIVO_DELTA', nombre: 'Operativo Delta', orden: 386, nivelMando: 4, aliases: ['operativo delta'] },
      { key: 'CAOS.OPERATIVO_BETA', nombre: 'Operativo Beta', orden: 387, nivelMando: 4, aliases: ['operativo beta'] },
      { key: 'CAOS.OPERATIVO_ALFA', nombre: 'Operativo Alfa', orden: 388, nivelMando: 4, aliases: ['operativo alfa'] },
      { key: 'CAOS.CONSCRIPTO', nombre: 'Conscripto', orden: 389, nivelMando: 4, aliases: ['conscripto'] },
    ],
  },
};

/** Roles de permisos especiales (detectar si existen; crear solo si faltan) */
const ROLES_PERMISOS = [
  { key: 'PERM.N0', nombreRol: 'Nivel 0 · Público', orden: 421, color: '#888780', aliases: ['nivel 0', 'nivel 0 publico', 'nivel 0 · publico'] },
  { key: 'PERM.N1', nombreRol: 'Nivel 1 · Confidencial', orden: 422, color: '#378ADD', aliases: ['nivel 1', 'nivel 1 confidencial'] },
  { key: 'PERM.N2', nombreRol: 'Nivel 2 · Restringido', orden: 423, color: '#378ADD', aliases: ['nivel 2', 'nivel 2 restringido'] },
  { key: 'PERM.N3', nombreRol: 'Nivel 3 · Secreto', orden: 424, color: '#BA7517', aliases: ['nivel 3', 'nivel 3 secreto'] },
  { key: 'PERM.N4', nombreRol: 'Nivel 4 · Alto Secreto', orden: 425, color: '#E67E22', aliases: ['nivel 4', 'nivel 4 alto secreto'] },
  { key: 'PERM.N5', nombreRol: 'Nivel 5 · Meridiano', orden: 426, color: '#7F77DD', aliases: ['nivel 5', 'nivel 5 meridiano'] },
  { key: 'PERM.VERIFICADO', nombreRol: 'Verificado en Roblox', orden: 427, color: '#3BA55D', aliases: ['verificado en roblox', 'verificado'] },
  { key: 'PERM.SUSPENDIDO', nombreRol: 'Suspendido', orden: 428, color: '#E24B4A', aliases: ['suspendido'] },
  { key: 'PERM.VISITANTE', nombreRol: 'Visitante', orden: 429, color: '#888780', aliases: ['visitante'] },
];

/** Nombres a IGNORAR siempre (no tocar) */
const ROLES_IGNORAR = [
  'bot oficial', 'bots', 'bot', '@everyone',
];

const ROLES_APOYO = {
  areas: [],
  autorizacion: ROLES_PERMISOS.filter((p) => p.key.startsWith('PERM.N')).map((p) => p.nombreRol),
  estado: ['Verificado en Roblox', 'Suspendido', 'Visitante'],
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

function formatoRol(prefijo, nombreCargo) {
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
        nombreRol: formatoRol(rama.prefijo, cargo.nombre),
        tipo: 'cargo',
      });
    }
  }
  return lista;
}

/** Lista plana ordenada: separadores + cargos + permisos */
function getJerarquiaCompleta() {
  const items = [];

  for (const sep of SEPARADORES) {
    items.push({ ...sep, tipo: 'separador', nombreRol: sep.nombreRol });
  }
  for (const c of getTodosCargos()) {
    items.push(c);
  }
  for (const p of ROLES_PERMISOS) {
    items.push({ ...p, tipo: 'permiso', prefijo: null });
  }

  items.sort((a, b) => (a.orden || 999) - (b.orden || 999));
  return items;
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

/** Extrae el nombre “humano” de un rol Discord (quita prefijo XX ●┇ o [XX]) */
function nombreBaseRol(nombreDiscord) {
  return String(nombreDiscord || '')
    .replace(/^[A-Z0-9]{1,6}\s*●┇\s*/i, '')
    .replace(/^\[[A-Z0-9]{1,6}\]\s*/i, '')
    .replace(/^━+\s*/u, '')
    .replace(/\s*━+$/u, '')
    .trim();
}

module.exports = {
  ORGANIGRAMA,
  SEPARADORES,
  ROLES_PERMISOS,
  ROLES_IGNORAR,
  ROLES_APOYO,
  SITIOS_DEFAULT,
  CLASES_CONTENCION_DEFAULT,
  ALERTAS,
  formatoRol,
  getTodosCargos,
  getJerarquiaCompleta,
  getCargoPorKey,
  getPosicionCargo,
  nombreBaseRol,
};
