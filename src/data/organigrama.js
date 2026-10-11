/**
 * Organigrama oficial · Fundacion Aegis-Meridian
 * Formato: "XX ●┇Nombre"
 * Emoji SOLO en Fundador y Cofundadores.
 *
 * Orden visual:
 *   FUNDACION → (solo fundadores)
 *   DIRECCIONES → directores, gerentes, comandante seguridad
 *   STAFF SERVIDOR → administradores
 *   SOPORTE → soporte tecnico
 *   CUPULA → consejo
 *   SI / SEG / MED / INV / INT / CD / CAOS / PERMISOS
 */

const FORMATO = (prefijo, nombre) => `${prefijo} ●┇${nombre}`;
const FORMATO_EMOJI = (emoji, prefijo, nombre) => `${emoji} ${prefijo} ●┇${nombre}`;

const SEPARADORES = [
  { key: 'SEP.FUNDACION', nombreRol: '———— FUNDACION ————', orden: 10, color: '#2B2D31' },
  { key: 'SEP.DIRECCIONES', nombreRol: '———— DIRECCIONES ————', orden: 20, color: '#2B2D31' },
  { key: 'SEP.STAFF', nombreRol: '———— STAFF SERVIDOR ————', orden: 40, color: '#2B2D31' },
  { key: 'SEP.SOPORTE', nombreRol: '———— SOPORTE ————', orden: 50, color: '#2B2D31' },
  { key: 'SEP.CUPULA', nombreRol: '———— CUPULA ————', orden: 60, color: '#2B2D31' },
  { key: 'SEP.SI', nombreRol: '———— SEGURIDAD INTERNA ————', orden: 80, color: '#2B2D31' },
  { key: 'SEP.SEG', nombreRol: '———— FACCION SEGURIDAD ————', orden: 120, color: '#2B2D31' },
  { key: 'SEP.MED', nombreRol: '———— MEDICINA ————', orden: 180, color: '#2B2D31' },
  { key: 'SEP.INV', nombreRol: '———— INVESTIGACION ————', orden: 220, color: '#2B2D31' },
  { key: 'SEP.INT', nombreRol: '———— INTELIGENCIA ————', orden: 260, color: '#2B2D31' },
  { key: 'SEP.CD', nombreRol: '———— CLASE D ————', orden: 300, color: '#2B2D31' },
  { key: 'SEP.CAOS', nombreRol: '———— INSURGENCIA ————', orden: 340, color: '#2B2D31' },
  { key: 'SEP.PERMISOS', nombreRol: '———— PERMISOS ————', orden: 380, color: '#2B2D31' },
];

const ORGANIGRAMA = {
  fundacion: {
    prefijo: 'ST',
    color: '#F0B232',
    nombre: 'Fundacion',
    cargos: [
      {
        key: 'ST.FUNDADOR',
        nombre: 'Fundador',
        orden: 11,
        nivelMando: 1,
        emoji: '👑',
        aliases: ['fundador', 'founder', 'dueño', 'dueno'],
      },
      {
        key: 'ST.CO_CALIDAD',
        nombre: 'Cofundador de Calidad y Cumplimiento',
        orden: 12,
        nivelMando: 1,
        emoji: '👑',
        aliases: [
          'cofundador de calidad y cumplimiento',
          'co-fundador de cumplimiento y calidad',
          'co fundador de calidad y cumplimiento',
          'cofundador de calidad',
          'cofundador calidad',
          'calidad y cumplimiento',
        ],
      },
      {
        key: 'ST.CO_ESTRATEGIA',
        nombre: 'Cofundador de Estrategia y Estatuto',
        orden: 13,
        nivelMando: 1,
        emoji: '👑',
        aliases: [
          'cofundador de estrategia y estatuto',
          'co-fundador de estatutos y estrategia',
          'co fundador de estrategia y estatuto',
          'cofundador de estrategia',
          'cofundador estrategia',
          'estrategia y estatuto',
        ],
      },
    ],
  },

  direcciones: {
    prefijo: 'DIR',
    color: '#5865F2',
    nombre: 'Direcciones',
    cargos: [
      {
        key: 'SI.GERENTE',
        nombre: 'Gerente de Seguridad Interna',
        orden: 21,
        nivelMando: 2,
        aliases: [
          'gerente de seguridad interna',
          'gerente se seguridad interna',
          'gerente si',
          'gerente de si',
        ],
      },
      {
        key: 'DIR.GENERAL',
        nombre: 'Director General',
        orden: 22,
        nivelMando: 1,
        aliases: ['director general', 'dir general', 'dg'],
      },
      {
        key: 'INT.GERENTE',
        nombre: 'Gerente de Inteligencia',
        orden: 23,
        nivelMando: 2,
        aliases: ['gerente de inteligencia', 'gerente inteligencia'],
      },
      {
        key: 'SEG.COMANDANTE',
        nombre: 'Comandante de Seguridad',
        orden: 24,
        nivelMando: 2,
        aliases: ['comandante de seguridad', 'comandante seguridad'],
      },
      {
        key: 'MED.DIRECTOR',
        nombre: 'Director Medico',
        orden: 25,
        nivelMando: 2,
        aliases: ['director medico', 'director médico', 'dir medico', 'director de medicina'],
      },
      {
        key: 'INV.DIRECTOR',
        nombre: 'Director de Investigacion Cientifica',
        orden: 26,
        nivelMando: 2,
        aliases: [
          'director de investigacion cientifica',
          'director de investigación científica',
          'director de investigacion',
          'director investigacion',
        ],
      },
    ],
  },

  staff: {
    prefijo: 'ST',
    color: '#F0B232',
    nombre: 'Staff Servidor',
    cargos: [
      {
        key: 'ST.ADMIN_JEFE',
        nombre: 'Administrador en Jefe',
        orden: 41,
        nivelMando: 1,
        aliases: ['administrador en jefe', 'admin en jefe', 'admin jefe', 'administrador jefe'],
      },
      {
        key: 'ST.ADMIN_SENIOR',
        nombre: 'Administrador Senior',
        orden: 42,
        nivelMando: 1,
        aliases: ['administrador senior', 'admin senior', 'admin sr'],
      },
      {
        key: 'ST.ADMIN_PRUEBA',
        nombre: 'Administrador en Prueba',
        orden: 43,
        nivelMando: 1,
        aliases: ['administrador en prueba', 'admin en prueba', 'admin prueba'],
      },
    ],
  },

  soporte: {
    prefijo: 'SP',
    color: '#3BA55D',
    nombre: 'Soporte',
    cargos: [
      {
        key: 'SP.TECNICO',
        nombre: 'Soporte Tecnico',
        orden: 51,
        nivelMando: 1,
        aliases: ['soporte tecnico', 'soporte técnico', 'soporte', 'tech support'],
      },
      {
        key: 'SP.TECNICO_PRUEBA',
        nombre: 'Soporte Tecnico en Prueba',
        orden: 52,
        nivelMando: 1,
        aliases: ['soporte tecnico en prueba', 'soporte técnico en prueba', 'soporte en prueba'],
      },
    ],
  },

  cupula: {
    prefijo: 'CUP',
    color: '#7F77DD',
    nombre: 'Cupula',
    cargos: [
      {
        key: 'CUP.PRESIDENTE',
        nombre: 'Presidente del Consejo',
        orden: 61,
        nivelMando: 1,
        aliases: ['presidente del consejo', 'presidente'],
      },
      {
        key: 'CUP.CONSEJO',
        nombre: 'Consejo Directivo',
        orden: 62,
        nivelMando: 1,
        aliases: ['consejo directivo', 'junta de directores', 'consejo'],
      },
    ],
  },

  seguridad_interna: {
    prefijo: 'SI',
    color: '#7F77DD',
    nombre: 'Seguridad Interna',
    cargos: [
      { key: 'SI.JEFE', nombre: 'Jefe de Seguridad Interna', orden: 81, nivelMando: 3, aliases: ['jefe de seguridad interna', 'jefe si'] },
      { key: 'SI.SUPERVISOR', nombre: 'Supervisor de Seguridad Interna', orden: 82, nivelMando: 3, aliases: ['supervisor de seguridad interna', 'supervisor si'] },
      { key: 'SI.INTERROGATORIO', nombre: 'Encargado de Interrogatorio de Seguridad Interna', orden: 83, nivelMando: 3, aliases: ['encargado de interrogatorio de seguridad interna', 'encargado de interrogatorio', 'interrogatorio'] },
      { key: 'SI.AGENTE_CAMPO', nombre: 'Agente de Campo de Seguridad Interna', orden: 84, nivelMando: 4, aliases: ['agente de campo de seguridad interna', 'agente de campo si'] },
      { key: 'SI.AGENTE', nombre: 'Agente de Seguridad Interna', orden: 85, nivelMando: 4, aliases: ['agente de seguridad interna', 'agente si'] },
      { key: 'SI.INGRESO', nombre: 'Agente de Ingreso de Seguridad Interna', orden: 86, nivelMando: 4, aliases: ['agente de ingreso de seguridad interna', 'agente de ingreso si', 'agente de ingreso'] },
    ],
  },

  seguridad: {
    prefijo: 'SEG',
    color: '#378ADD',
    nombre: 'Faccion de Seguridad',
    cargos: [
      { key: 'SEG.COMANDANTES', nombre: 'Comandantes de Facciones de Seguridad', orden: 121, nivelMando: 2, aliases: ['comandantes de facciones de seguridad', 'comandante de faccion de seguridad', 'comandantes de faccion'] },
      { key: 'SEG.SUB_GUARDIA', nombre: 'Subcomandante de Guardia', orden: 122, nivelMando: 3, aliases: ['sub comandante de guardia', 'subcomandante de guardia', 'subcomandante guardia'] },
      { key: 'SEG.SUB_RR', nombre: 'Subcomandante de Respuesta Rapida', orden: 123, nivelMando: 3, aliases: ['subcomandante de respuesta rapida', 'subcomandante de respuesta rápida', 'sub comandante de respuesta rapida', 'subcomandante err', 'subcomandante rr'] },
      { key: 'SEG.SUB_FTM', nombre: 'Subcomandante de Fuerza de Trabajo Movil', orden: 124, nivelMando: 3, aliases: ['subcomandante de fuerza de trabajo mobil', 'subcomandante de fuerza de trabajo móvil', 'sub comandante de fuerza de trabajo mobil', 'subcomandante ftm'] },
      { key: 'SEG.CAPITAN', nombre: 'Capitan de Seguridad', orden: 125, nivelMando: 3, aliases: ['capitan de seguridad', 'capitán de seguridad', 'capitan'] },
      { key: 'SEG.TENIENTE', nombre: 'Teniente de Seguridad', orden: 126, nivelMando: 3, aliases: ['teniente de seguridad', 'teniente'] },
      { key: 'SEG.SARGENTO', nombre: 'Sargento de Seguridad', orden: 127, nivelMando: 4, aliases: ['sargento de seguridad', 'sargento'] },
      { key: 'SEG.CABO', nombre: 'Cabo de Seguridad', orden: 128, nivelMando: 4, aliases: ['cabo de seguridad', 'cabo'] },
      { key: 'SEG.SOLDADO', nombre: 'Soldado de Seguridad', orden: 129, nivelMando: 4, aliases: ['soldado de seguridad', 'soldado'] },
      { key: 'SEG.CADETE', nombre: 'Cadete de Seguridad', orden: 130, nivelMando: 4, aliases: ['cadete de seguridad', 'cadete'] },
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
      { key: 'MED.SUBDIRECTOR', nombre: 'Subdirector Medico', orden: 181, nivelMando: 3, aliases: ['subdirector medico', 'subdirector médico'] },
      { key: 'MED.JEFE', nombre: 'Jefe de Medicina', orden: 182, nivelMando: 3, aliases: ['jefe de medicina', 'jefe medico'] },
      { key: 'MED.SUPERVISOR', nombre: 'Supervisor Medico', orden: 183, nivelMando: 3, aliases: ['supervisor medico', 'supervisor médico'] },
      { key: 'MED.MEDICO', nombre: 'Medico', orden: 184, nivelMando: 4, aliases: ['medico', 'médico'] },
      { key: 'MED.ENFERMERO', nombre: 'Enfermero', orden: 185, nivelMando: 4, aliases: ['enfermero', 'enfermera'] },
      { key: 'MED.RESIDENTE', nombre: 'Residente', orden: 186, nivelMando: 4, aliases: ['residente'] },
      { key: 'MED.INGRESO', nombre: 'Medico en Ingreso', orden: 187, nivelMando: 4, aliases: ['medico en ingreso', 'médico en ingreso'] },
    ],
  },

  investigacion: {
    prefijo: 'INV',
    color: '#5865F2',
    nombre: 'Investigacion',
    cargos: [
      { key: 'INV.SUBDIRECTOR', nombre: 'Subdirector de Investigacion', orden: 221, nivelMando: 3, aliases: ['subdirector de investigacion', 'subdirector de investigación'] },
      { key: 'INV.JEFE', nombre: 'Jefe de Investigacion', orden: 222, nivelMando: 3, aliases: ['jefe de investigacion', 'jefe de investigación'] },
      { key: 'INV.SUPERVISOR', nombre: 'Supervisor de Investigacion', orden: 223, nivelMando: 3, aliases: ['supervisor de investigacion', 'supervisor de investigación'] },
      { key: 'INV.CIENTIFICO', nombre: 'Cientifico', orden: 224, nivelMando: 4, aliases: ['cientifico', 'científico'] },
      { key: 'INV.INVESTIGADOR', nombre: 'Investigador', orden: 225, nivelMando: 4, aliases: ['investigador'] },
      { key: 'INV.ASISTENTE', nombre: 'Asistente de Investigacion', orden: 226, nivelMando: 4, aliases: ['asistente de investigacion', 'asistente de investigación'] },
      { key: 'INV.INGRESO', nombre: 'Investigador en Ingreso', orden: 227, nivelMando: 4, aliases: ['investigador en ingreso'] },
    ],
  },

  inteligencia: {
    prefijo: 'INT',
    color: '#7F77DD',
    nombre: 'Inteligencia',
    cargos: [
      { key: 'INT.SUBGERENTE', nombre: 'Subgerente de Inteligencia', orden: 261, nivelMando: 3, aliases: ['subgerente de inteligencia'] },
      { key: 'INT.SUPERVISOR', nombre: 'Supervisor de Inteligencia', orden: 262, nivelMando: 3, aliases: ['supervisor de inteligencia'] },
      { key: 'INT.AGENTE_SENIOR', nombre: 'Agente Senior de Inteligencia', orden: 263, nivelMando: 4, aliases: ['agente senior de inteligencia', 'agente sénior de inteligencia'] },
      { key: 'INT.AGENTE_CAMPO', nombre: 'Agente de Campo de Inteligencia', orden: 264, nivelMando: 4, aliases: ['agente de campo de inteligencia'] },
      { key: 'INT.INGRESO', nombre: 'Agente de Ingreso de Inteligencia', orden: 265, nivelMando: 4, aliases: ['agente de ingreso de inteligencia'] },
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
  { key: 'PERM.SUSPENDIDO', nombreRol: 'Suspendido', orden: 388, color: '#E24B4A', aliases: ['suspendido'] },
  { key: 'PERM.VISITANTE', nombreRol: 'Visitante', orden: 389, color: '#888780', aliases: ['visitante'] },
];

const ROLES_IGNORAR = ['bot oficial', 'bots', 'bot', '@everyone'];

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
  items.sort((a, b) => (a.orden || 999) - (b.orden || 999));
  return items;
}

function getOrganigramaTexto() {
  const lineas = [];
  const items = getJerarquiaCompleta().filter((i) => i.tipo !== 'permiso');
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
