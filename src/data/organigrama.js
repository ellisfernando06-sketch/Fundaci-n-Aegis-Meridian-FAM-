/**
 * Organigrama oficial de la Fundación Aegis-Meridian
 * Fuente de verdad para permisos, roles, plantillas, /organigrama y /config_roles
 * Formato de clave interna: RAMA.CARGO (ej. MED.DIRECTOR_MEDICO)
 */

const ORGANIGRAMA = {
  cupula: {
    prefijo: 'CUP',
    color: '#7F77DD',
    nombre: 'Cúpula',
    cargos: [
      { key: 'CUP.FUNDADOR', nombre: 'Fundador', nivelMando: 1 },
      { key: 'CUP.CO_FUNDADOR_CUMPLIMIENTO', nombre: 'Co-Fundador de Cumplimiento y Calidad', nivelMando: 1 },
      { key: 'CUP.CO_FUNDADOR_ESTATUTOS', nombre: 'Co-Fundador de Estatutos y Estrategia', nivelMando: 1 },
      { key: 'CUP.JUNTA_DIRECTORES', nombre: 'Junta de Directores', nivelMando: 1 },
      { key: 'CUP.DIRECTOR_GENERAL', nombre: 'Director General', nivelMando: 1 },
    ],
  },
  medicina: {
    prefijo: 'MED',
    color: '#1D9E75',
    nombre: 'Medicina',
    cargos: [
      { key: 'MED.DIRECTOR_MEDICO', nombre: 'Director Médico', nivelMando: 2 },
      { key: 'MED.SUBDIRECTOR_MEDICO', nombre: 'Subdirector Médico', nivelMando: 3 },
      { key: 'MED.MEDICO_ADJUNTO', nombre: 'Médico Adjunto', nivelMando: 3 },
      { key: 'MED.ESPECIALISTA_CLINICO', nombre: 'Especialista Clínico', nivelMando: 3 },
      { key: 'MED.JEFE_RESIDENTES', nombre: 'Jefe de Residentes', nivelMando: 4 },
      { key: 'MED.RESIDENTE_SENIOR', nombre: 'Residente Sénior', nivelMando: 4 },
      { key: 'MED.RESIDENTE', nombre: 'Residente', nivelMando: 4 },
      { key: 'MED.RESIDENTE_JUNIOR', nombre: 'Residente Júnior', nivelMando: 4 },
      { key: 'MED.INTERNO', nombre: 'Interno de Medicina', nivelMando: 4 },
    ],
  },
  investigacion: {
    prefijo: 'INV',
    color: '#1D9E75',
    nombre: 'Investigación',
    cargos: [
      { key: 'INV.DIRECTOR_INVESTIGACION', nombre: 'Director de Investigación Científica', nivelMando: 2 },
      { key: 'INV.SUBDIRECTOR_INVESTIGACION', nombre: 'Subdirector de Investigación', nivelMando: 3 },
      { key: 'INV.JEFE_INVESTIGACION', nombre: 'Jefe de Investigación', nivelMando: 3 },
      { key: 'INV.INVESTIGADOR_SENIOR', nombre: 'Investigador Sénior', nivelMando: 3 },
      { key: 'INV.INVESTIGADOR', nombre: 'Investigador', nivelMando: 4 },
      { key: 'INV.INVESTIGADOR_JUNIOR', nombre: 'Investigador Júnior', nivelMando: 4 },
      { key: 'INV.INTERNO', nombre: 'Interno de Investigación', nivelMando: 4 },
    ],
  },
  clase_d: {
    prefijo: 'CD',
    color: '#888780',
    nombre: 'Clase D',
    cargos: [
      { key: 'CD.VETERANO', nombre: 'Clase D Veterano', nivelMando: 4 },
      { key: 'CD.AVANZADO', nombre: 'Clase D Avanzado', nivelMando: 4 },
      { key: 'CD.ADEPTO', nombre: 'Clase D Adepto', nivelMando: 4 },
      { key: 'CD.DEDICADO', nombre: 'Clase D Dedicado', nivelMando: 4 },
      { key: 'CD.CLASE_D', nombre: 'Clase D', nivelMando: 4 },
    ],
  },
  seguridad: {
    prefijo: 'SEG',
    color: '#378ADD',
    nombre: 'Seguridad (Guardia)',
    cargos: [
      { key: 'SEG.COMANDANTE', nombre: 'Comandante', nivelMando: 2 },
      { key: 'SEG.SUBCOMANDANTE', nombre: 'Subcomandante', nivelMando: 3 },
      { key: 'SEG.JEFE_OPERACIONES', nombre: 'Jefe de Operaciones', nivelMando: 3 },
      { key: 'SEG.CAPITAN', nombre: 'Capitán', nivelMando: 3 },
      { key: 'SEG.TENIENTE', nombre: 'Teniente', nivelMando: 4 },
      { key: 'SEG.SARGENTO_PRIMERO', nombre: 'Sargento Primero', nivelMando: 4 },
      { key: 'SEG.SARGENTO', nombre: 'Sargento', nivelMando: 4 },
      { key: 'SEG.CABO', nombre: 'Cabo', nivelMando: 4 },
      { key: 'SEG.SOLDADO', nombre: 'Soldado', nivelMando: 4 },
      { key: 'SEG.CADETE', nombre: 'Cadete', nivelMando: 4 },
    ],
  },
  ftm: {
    prefijo: 'FTM',
    color: '#378ADD',
    nombre: 'FTM',
    cargos: [
      { key: 'FTM.JEFE_FUERZA', nombre: 'Jefe de Fuerza de Tarea', nivelMando: 2 },
      { key: 'FTM.TENIENTE_FUERZA', nombre: 'Teniente de Fuerza de Tarea', nivelMando: 3 },
      { key: 'FTM.SARGENTO_FUERZA', nombre: 'Sargento de Fuerza de Tarea', nivelMando: 3 },
      { key: 'FTM.OPERATIVO_ELITE', nombre: 'Operativo de Élite', nivelMando: 3 },
      { key: 'FTM.OPERATIVO_SENIOR', nombre: 'Operativo Sénior', nivelMando: 4 },
      { key: 'FTM.OPERATIVO', nombre: 'Operativo', nivelMando: 4 },
      { key: 'FTM.RECLUTA', nombre: 'Recluta', nivelMando: 4 },
    ],
  },
  err: {
    prefijo: 'ERR',
    color: '#378ADD',
    nombre: 'ERR',
    cargos: [
      { key: 'ERR.JEFE_ERR', nombre: 'Jefe del ERR', nivelMando: 2 },
      { key: 'ERR.SUBJEFE_ERR', nombre: 'Subjefe del ERR', nivelMando: 3 },
      { key: 'ERR.OFICIAL_MANDO', nombre: 'Oficial al Mando de Escuadrón', nivelMando: 3 },
      { key: 'ERR.LIDER_ESCUADRON', nombre: 'Líder de Escuadrón', nivelMando: 3 },
      { key: 'ERR.LIDER_EQUIPO', nombre: 'Líder de Equipo', nivelMando: 4 },
      { key: 'ERR.TENIENTE_EQUIPO', nombre: 'Teniente de Equipo', nivelMando: 4 },
      { key: 'ERR.OPERATIVO_TACTICO', nombre: 'Operativo Táctico', nivelMando: 4 },
      { key: 'ERR.OPERATIVO_FORMACION', nombre: 'Operativo en Formación', nivelMando: 4 },
      { key: 'ERR.RECLUTA', nombre: 'Recluta', nivelMando: 4 },
    ],
  },
  inteligencia: {
    prefijo: 'INT',
    color: '#BA7517',
    nombre: 'Inteligencia',
    cargos: [
      { key: 'INT.GERENTE_INTELIGENCIA', nombre: 'Gerente de Inteligencia', nivelMando: 2 },
      { key: 'INT.SUBGERENTE_INTELIGENCIA', nombre: 'Subgerente de Inteligencia', nivelMando: 3 },
      { key: 'INT.SUPERVISOR_SENIOR', nombre: 'Supervisor Sénior', nivelMando: 3 },
      { key: 'INT.SUPERVISOR', nombre: 'Supervisor', nivelMando: 3 },
      { key: 'INT.AGENTE_SENIOR', nombre: 'Agente Sénior', nivelMando: 4 },
      { key: 'INT.AGENTE_CAMPO', nombre: 'Agente de Campo', nivelMando: 4 },
      { key: 'INT.AGENTE_INGRESO', nombre: 'Agente de Ingreso', nivelMando: 4 },
    ],
  },
  seguridad_interna: {
    prefijo: 'SI',
    color: '#7F77DD',
    nombre: 'Seguridad Interna',
    cargos: [
      { key: 'SI.GERENTE_SI', nombre: 'Gerente de Seguridad Interna', nivelMando: 2 },
      { key: 'SI.SUBGERENTE_SI', nombre: 'Subgerente de Seguridad Interna', nivelMando: 3 },
      { key: 'SI.SUPERVISOR_SENIOR', nombre: 'Supervisor Sénior', nivelMando: 3 },
      { key: 'SI.SUPERVISOR', nombre: 'Supervisor', nivelMando: 3 },
      { key: 'SI.AGENTE_SENIOR', nombre: 'Agente Sénior', nivelMando: 4 },
      { key: 'SI.AGENTE_CAMPO', nombre: 'Agente de Campo', nivelMando: 4 },
      { key: 'SI.AGENTE_INGRESO', nombre: 'Agente de Ingreso', nivelMando: 4 },
    ],
  },
  insurgencia: {
    prefijo: 'CAOS',
    color: '#E24B4A',
    nombre: 'Insurgencia del Caos',
    cargos: [
      { key: 'CAOS.MANDO_INSURGENCIA', nombre: 'Mando de la Insurgencia', nivelMando: 2 },
      { key: 'CAOS.MANDO_GAMMA', nombre: 'Mando Gamma', nivelMando: 3 },
      { key: 'CAOS.MANDO_DELTA', nombre: 'Mando Delta', nivelMando: 3 },
      { key: 'CAOS.DIRECTOR_CELULA', nombre: 'Director de Célula', nivelMando: 3 },
      { key: 'CAOS.AGENTE_CELULA', nombre: 'Agente de Célula', nivelMando: 4 },
      { key: 'CAOS.OPERATIVO_DELTA', nombre: 'Operativo Delta', nivelMando: 4 },
      { key: 'CAOS.OPERATIVO_BETA', nombre: 'Operativo Beta', nivelMando: 4 },
      { key: 'CAOS.OPERATIVO_ALFA', nombre: 'Operativo Alfa', nivelMando: 4 },
      { key: 'CAOS.CONSCRIPTO_SENIOR', nombre: 'Conscripto Sénior', nivelMando: 4 },
      { key: 'CAOS.CONSCRIPTO_ENTRENADO', nombre: 'Conscripto Entrenado', nivelMando: 4 },
      { key: 'CAOS.CONSCRIPTO', nombre: 'Conscripto', nivelMando: 4 },
    ],
  },
};

/** Roles de apoyo (además de los de cargo) */
const ROLES_APOYO = {
  areas: [
    'Área · Medicina',
    'Área · Investigación',
    'Área · Seguridad',
    'Área · FTM',
    'Área · ERR',
    'Área · Inteligencia',
    'Área · Seguridad Interna',
    'Área · Clase D',
    'Área · Insurgencia',
  ],
  autorizacion: [
    'Nivel 0 · Público',
    'Nivel 1 · Confidencial',
    'Nivel 2 · Restringido',
    'Nivel 3 · Secreto',
    'Nivel 4 · Alto Secreto',
    'Nivel 5 · Meridiano',
  ],
  estado: [
    'Verificado en Roblox',
    'Suspendido',
    'Visitante',
  ],
  administracion: [
    'Administración del Bot',
  ],
};

/** Sitios por defecto (editables en /config) */
const SITIOS_DEFAULT = [
  'Sitio Meridiano',
  'Sitio Alfa-7',
  'Sitio Beta-12',
  'Sitio Gamma-3',
  'Sitio Delta-9',
  'Sitio Omega-1',
];

/** Clases de contención por defecto */
const CLASES_CONTENCION_DEFAULT = [
  { nombre: 'Seguro', accesoSugerido: 2 },
  { nombre: 'Euclid', accesoSugerido: 3 },
  { nombre: 'Keter', accesoSugerido: 4 },
  { nombre: 'Thaumiel', accesoSugerido: 5 },
  { nombre: 'Apollyon', accesoSugerido: 5 },
];

/** Niveles de alerta */
const ALERTAS = [
  { codigo: 'Verde', color: '#2E9E5B', emoji: '🟢' },
  { codigo: 'Amarillo', color: '#E8B923', emoji: '🟡' },
  { codigo: 'Naranja', color: '#E67E22', emoji: '🟠' },
  { codigo: 'Rojo', color: '#E24B4A', emoji: '🔴' },
  { codigo: 'Negro', color: '#1A1A1A', emoji: '⚫' },
];

/**
 * Devuelve el nombre de rol de Discord con formato [PREFIJO] Cargo
 */
function formatoRol(prefijo, nombreCargo) {
  return `[${prefijo}] ${nombreCargo}`;
}

/**
 * Obtiene todos los cargos planos con su información completa
 */
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
      });
    }
  }
  return lista;
}

/**
 * Busca un cargo por su clave interna
 */
function getCargoPorKey(key) {
  return getTodosCargos().find((c) => c.key === key) || null;
}

/**
 * Obtiene la posición de un cargo dentro de su escalera (0 = mayor rango)
 */
function getPosicionCargo(key) {
  for (const rama of Object.values(ORGANIGRAMA)) {
    const idx = rama.cargos.findIndex((c) => c.key === key);
    if (idx !== -1) return idx;
  }
  return -1;
}

module.exports = {
  ORGANIGRAMA,
  ROLES_APOYO,
  SITIOS_DEFAULT,
  CLASES_CONTENCION_DEFAULT,
  ALERTAS,
  formatoRol,
  getTodosCargos,
  getCargoPorKey,
  getPosicionCargo,
};
