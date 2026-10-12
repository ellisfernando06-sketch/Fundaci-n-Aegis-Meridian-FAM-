/**
 * Plantilla de canales · Fundacion Aegis-Meridian
 * Texto:  ︱{emoji}・nombre
 * Voz:    ︱💼・𝐎𝐟𝐢𝐜𝐢𝐧𝐚 𝐝𝐞 …
 */

const T = (emoji, nombre) => `︱${emoji}・${nombre}`;
const V = (nombre) => `︱💼・${nombre}`;

const ESTRUCTURA = [
  {
    key: 'CAT.INGRESO',
    nombre: '✦ INGRESO',
    canales: [
      { key: 'CH.VERIFICACION', nombre: T('✅', 'verificacion'), keys: [], publico: true, writePublic: true },
      { key: 'CH.REGLAS', nombre: T('📜', 'reglas'), keys: [], publico: true, writePublic: false },
      { key: 'CH.ANUNCIOS', nombre: T('📢', 'anuncios'), keys: [], publico: true, writePublic: false },
      { key: 'CH.BIENVENIDA', nombre: T('👋', 'bienvenida'), keys: [], publico: true, writePublic: false },
    ],
  },
  {
    key: 'CAT.LOGS',
    nombre: '✦ LOGS · MANDO',
    canales: [
      { key: 'CH.SOLICITUDES', nombre: T('📋', 'solicitudes-ingreso'), keys: ['KEY-CUP-01', 'KEY-SI-03'], publico: false, configKey: 'canal_solicitudes' },
      { key: 'CH.LOG_SANCIONES', nombre: T('⚖️', 'log-sanciones'), keys: ['KEY-SI-01', 'KEY-SI-03'], publico: false, configKey: 'canal_log_sanciones' },
      { key: 'CH.LOG_ALERTAS', nombre: T('🚨', 'log-alertas'), keys: ['KEY-ESP-06', 'KEY-SEG-04'], publico: false, configKey: 'canal_log_alertas' },
      { key: 'CH.LOG_AUDITORIA', nombre: T('🔍', 'log-auditoria'), keys: ['KEY-SI-01', 'KEY-SI-03'], publico: false, configKey: 'canal_log_auditoria' },
      { key: 'CH.LOG_PERSONAL', nombre: T('📁', 'log-personal'), keys: ['KEY-CUP-01', 'KEY-SI-03'], publico: false, configKey: 'canal_log_personal' },
      { key: 'CH.INTERNA', nombre: T('🕶️', 'investigacion-interna'), keys: ['KEY-SI-02', 'KEY-SI-03', 'KEY-INT-02'], publico: false, configKey: 'canal_interna' },
    ],
  },
  {
    key: 'CAT.CUPULA',
    nombre: '✦ CÚPULA',
    canales: [
      { key: 'CH.MERIDIANO', nombre: T('🟣', 'meridiano'), keys: ['KEY-CUP-01'], publico: false },
      { key: 'CH.JUNTA', nombre: T('🏛️', 'junta'), keys: ['KEY-CUP-02'], publico: false },
      { key: 'CH.COORD_DG', nombre: T('👔', 'coord-director-general'), keys: ['KEY-CUP-02'], publico: false },
    ],
  },
  {
    key: 'CAT.SEGURIDAD',
    nombre: '✦ SEGURIDAD',
    canales: [
      { key: 'CH.GUARDIA', nombre: T('🛡️', 'puestos-guardia'), keys: ['KEY-SEG-01'], publico: false },
      { key: 'CH.VESTUARIO_SEG', nombre: T('👕', 'vestuario-seguridad'), keys: ['KEY-SEG-01'], publico: false },
      { key: 'CH.OFICIALES', nombre: T('⭐', 'sala-oficiales'), keys: ['KEY-SEG-02'], publico: false },
      { key: 'CH.COMANDO_SEG', nombre: T('📡', 'comando-seguridad'), keys: ['KEY-SEG-03', 'KEY-SEG-04'], publico: false },
      { key: 'CH.PLANES_DEFENSA', nombre: T('🗺️', 'planes-defensa'), keys: ['KEY-SEG-03', 'KEY-SEG-04'], publico: false },
      { key: 'CH.INCIDENTES', nombre: T('🚑', 'incidentes'), keys: ['KEY-SEG-01', 'KEY-SEG-02', 'KEY-SEG-03', 'KEY-SEG-04'], publico: false },
      { key: 'CH.MISIONES', nombre: T('🎯', 'misiones'), keys: ['KEY-SEG-02', 'KEY-SEG-03', 'KEY-SEG-04'], publico: false },
    ],
  },
  {
    key: 'CAT.FTM',
    nombre: '✦ FTM',
    canales: [
      { key: 'CH.CUARTEL_FTM', nombre: T('🪖', 'cuartel-ftm'), keys: ['KEY-FTM-01'], publico: false },
      { key: 'CH.OPS_FTM', nombre: T('⚔️', 'operaciones-ftm'), keys: ['KEY-FTM-01'], publico: false },
      { key: 'CH.MANDO_FTM', nombre: T('🎖️', 'mando-ftm'), keys: ['KEY-FTM-02'], publico: false },
    ],
  },
  {
    key: 'CAT.ERR',
    nombre: '✦ RESPUESTA RÁPIDA',
    canales: [
      { key: 'CH.AREA_ERR', nombre: T('🚒', 'area-respuesta'), keys: ['KEY-ERR-01'], publico: false },
      { key: 'CH.DESPLIEGUE_ERR', nombre: T('🚀', 'despliegue-respuesta'), keys: ['KEY-ERR-01'], publico: false },
      { key: 'CH.MANDO_ERR', nombre: T('📞', 'mando-respuesta'), keys: ['KEY-ERR-02'], publico: false },
    ],
  },
  {
    key: 'CAT.SI',
    nombre: '✦ SEGURIDAD INTERNA',
    canales: [
      { key: 'CH.AUDITORIA', nombre: T('📊', 'auditoria'), keys: ['KEY-SI-01'], publico: false },
      { key: 'CH.EXPEDIENTES', nombre: T('📂', 'expedientes-internos'), keys: ['KEY-SI-02'], publico: false },
      { key: 'CH.GERENCIA_SI', nombre: T('🔐', 'gerencia-si'), keys: ['KEY-SI-03'], publico: false },
      { key: 'CH.SANCIONES', nombre: T('🔨', 'sanciones'), keys: ['KEY-SI-01', 'KEY-SI-02', 'KEY-SI-03'], publico: false },
    ],
  },
  {
    key: 'CAT.INTEL',
    nombre: '✦ INTELIGENCIA',
    canales: [
      { key: 'CH.ARCHIVO_INT', nombre: T('🗃️', 'archivo-inteligencia'), keys: ['KEY-INT-01'], publico: false },
      { key: 'CH.OPS_INT', nombre: T('🕵️', 'operaciones-inteligencia'), keys: ['KEY-INT-02'], publico: false },
      { key: 'CH.GERENCIA_INT', nombre: T('🧠', 'gerencia-inteligencia'), keys: ['KEY-INT-03'], publico: false },
    ],
  },
  {
    key: 'CAT.MED',
    nombre: '✦ MEDICINA',
    canales: [
      { key: 'CH.CLINICA', nombre: T('🏥', 'clinica'), keys: ['KEY-MED-01'], publico: false },
      { key: 'CH.CONSULTORIOS', nombre: T('💊', 'consultorios'), keys: ['KEY-MED-01'], publico: false },
      { key: 'CH.CIRUGIA', nombre: T('🩺', 'cirugia-bioseguridad'), keys: ['KEY-MED-02'], publico: false },
      { key: 'CH.DIR_MED', nombre: T('⚕️', 'direccion-medica'), keys: ['KEY-MED-03'], publico: false },
    ],
  },
  {
    key: 'CAT.INV',
    nombre: '✦ INVESTIGACIÓN',
    canales: [
      { key: 'CH.LAB', nombre: T('🧪', 'laboratorio'), keys: ['KEY-INV-01'], publico: false },
      { key: 'CH.CAMARAS_ESTUDIO', nombre: T('🔬', 'camaras-estudio'), keys: ['KEY-INV-02'], publico: false },
      { key: 'CH.DIR_INV', nombre: T('🧬', 'direccion-cientifica'), keys: ['KEY-INV-03'], publico: false },
      { key: 'CH.ANOMALIAS', nombre: T('📎', 'registro-anomalias'), keys: ['KEY-INV-01', 'KEY-INV-02', 'KEY-INV-03'], publico: false },
    ],
  },
  {
    key: 'CAT.ESP',
    nombre: '✦ ACCESOS ESPECIALES',
    canales: [
      { key: 'CH.KETER', nombre: T('☠️', 'contencion-keter'), keys: ['KEY-ESP-01'], publico: false },
      { key: 'CH.ARMERIA', nombre: T('🔫', 'armeria-pesada'), keys: ['KEY-ESP-02'], publico: false },
      { key: 'CH.CAMARAS_PRUEBA', nombre: T('🎥', 'camaras-prueba'), keys: ['KEY-ESP-03'], publico: false },
      { key: 'CH.OMEGA', nombre: T('📚', 'archivo-omega-1'), keys: ['KEY-ESP-04'], publico: false },
      { key: 'CH.QUIROFANO_CONT', nombre: T('🩸', 'quirofano-contencion'), keys: ['KEY-ESP-05'], publico: false },
      { key: 'CH.SALA_CONTROL', nombre: T('🖥️', 'sala-de-control'), keys: ['KEY-ESP-06'], publico: false },
      { key: 'CH.BOVEDA', nombre: T('💎', 'boveda-artefactos'), keys: ['KEY-ESP-07'], publico: false },
      { key: 'CH.TRANSFERENCIAS', nombre: T('🚚', 'transferencias'), keys: ['KEY-ESP-08'], publico: false },
      { key: 'CH.INTERROGATORIO', nombre: T('🔒', 'interrogatorio'), keys: ['KEY-ESP-09'], publico: false },
    ],
  },
  {
    key: 'CAT.CD',
    nombre: '✦ CLASE D',
    canales: [
      { key: 'CH.CELDAS', nombre: T('⛓️', 'celdas'), keys: ['KEY-CD-01'], publico: false },
      { key: 'CH.COMEDOR_CD', nombre: T('🍽️', 'comedor-clase-d'), keys: ['KEY-CD-01'], publico: false },
      { key: 'CH.ZONA_CD', nombre: T('🚧', 'zona-clase-d'), keys: ['KEY-CD-01'], publico: false },
    ],
  },
  {
    key: 'CAT.CAOS',
    nombre: '✦ INSURGENCIA',
    canales: [
      { key: 'CH.ZONA_CAOS', nombre: T('🔴', 'zona-insurgente'), keys: ['KEY-CAOS-01'], publico: false },
      { key: 'CH.MANDO_CAOS', nombre: T('💀', 'mando-insurgente'), keys: ['KEY-CAOS-02'], publico: false },
    ],
  },
  {
    key: 'CAT.RP',
    nombre: '✦ ROLEPLAY',
    canales: [
      { key: 'CH.PASILLOS', nombre: T('🚶', 'pasillos'), keys: [], publico: true, writePublic: true },
      { key: 'CH.CAFETERIA', nombre: T('☕', 'cafeteria'), keys: [], publico: true, writePublic: true },
      { key: 'CH.LOBBY', nombre: T('🏠', 'lobby'), keys: [], publico: true, writePublic: true },
      { key: 'CH.RADIO', nombre: T('📻', 'radio-sitio'), keys: [], publico: true, writePublic: true },
    ],
  },
  {
    key: 'CAT.OFICINAS',
    nombre: '✦ OFICINAS',
    canales: [],
    voz: [
      { key: 'VC.OFICINA_FER', nombre: V('𝐎𝐟𝐢𝐜𝐢𝐧𝐚 𝐝𝐞 𝐅𝐞𝐫 💎') },
      { key: 'VC.OFICINA_TEST_1', nombre: V('𝐎𝐟𝐢𝐜𝐢𝐧𝐚 𝐝𝐞 𝐓𝐞𝐬𝐭 𝟏') },
      { key: 'VC.OFICINA_TEST_2', nombre: V('𝐎𝐟𝐢𝐜𝐢𝐧𝐚 𝐝𝐞 𝐓𝐞𝐬𝐭 𝟐') },
      { key: 'VC.OFICINA_TEST_3', nombre: V('𝐎𝐟𝐢𝐜𝐢𝐧𝐚 𝐝𝐞 𝐓𝐞𝐬𝐭 𝟑') },
      { key: 'VC.OFICINA_TEST_4', nombre: V('𝐎𝐟𝐢𝐜𝐢𝐧𝐚 𝐝𝐞 𝐓𝐞𝐬𝐭 𝟒') },
      { key: 'VC.OFICINA_TEST_5', nombre: V('𝐎𝐟𝐢𝐜𝐢𝐧𝐚 𝐝𝐞 𝐓𝐞𝐬𝐭 𝟓') },
      { key: 'VC.OFICINA_TEST_6', nombre: V('𝐎𝐟𝐢𝐜𝐢𝐧𝐚 𝐝𝐞 𝐓𝐞𝐬𝐭 𝟔') },
    ],
  },
];

function esCanalPlantillaAegis(nombre) {
  const n = String(nombre || '');
  if (n.startsWith('✦ ')) return true;
  if (/^︱/.test(n)) return true;
  if (/^[|｜¦]/.test(n) && n.includes('・')) return true;
  return false;
}

module.exports = {
  ESTRUCTURA,
  T,
  V,
  esCanalPlantillaAegis,
};
