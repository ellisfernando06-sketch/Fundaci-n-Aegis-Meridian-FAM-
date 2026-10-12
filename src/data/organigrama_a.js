/**
 * Organigrama oficial · Fundacion Aegis-Meridian
 * Formato: "XX ●┇Nombre"
 * Emoji SOLO en Fundador y Cofundadores.
 *
 * Orden visual:
 *   FUNDACION → (solo fundadores)
 *   DIRECCIONES → directores de F.A.M, gerentes
 *   MODERACION → admin jefe, senior, en prueba
 *   SOPORTE → soporte tecnico
 *   CUPULA → consejo
 *   SI / SEG / MED / INV / INT / CD / CAOS / PERMISOS
 *   En facciones: mandan jefes y subcomandantes (sin subdirectores ni subgerentes)
 */

const FORMATO = (prefijo, nombre) => `${prefijo} ●┇${nombre}`;
const FORMATO_EMOJI = (emoji, prefijo, nombre) => `${emoji} ${prefijo} ●┇${nombre}`;

const SEPARADORES = [
  { key: 'SEP.FUNDACION', nombreRol: '━━━━━━━━『  FUNDACIÓN  』━━━━━━━━', orden: 10, color: '#1a1a1e' },
  { key: 'SEP.DIRECCIONES', nombreRol: '━━━━━━━━『  DIRECCIONES  』━━━━━━━━', orden: 20, color: '#1a1a1e' },
  { key: 'SEP.MODERACION', nombreRol: '━━━━━━━━『  MODERACIÓN  』━━━━━━━━', orden: 40, color: '#1a1a1e' },
  { key: 'SEP.SOPORTE', nombreRol: '━━━━━━━━『  SOPORTE  』━━━━━━━━', orden: 50, color: '#1a1a1e' },
  { key: 'SEP.CUPULA', nombreRol: '━━━━━━━━『  CÚPULA  』━━━━━━━━', orden: 60, color: '#1a1a1e' },
  { key: 'SEP.SI', nombreRol: '━━━━━━━━『  SEGURIDAD INTERNA  』━━━━━━━━', orden: 80, color: '#1a1a1e' },
  { key: 'SEP.SEG', nombreRol: '━━━━━━━━『  FACCIÓN SEGURIDAD  』━━━━━━━━', orden: 120, color: '#1a1a1e' },
  { key: 'SEP.MED', nombreRol: '━━━━━━━━『  MEDICINA  』━━━━━━━━', orden: 180, color: '#1a1a1e' },
  { key: 'SEP.INV', nombreRol: '━━━━━━━━『  INVESTIGACIÓN  』━━━━━━━━', orden: 220, color: '#1a1a1e' },
  { key: 'SEP.INT', nombreRol: '━━━━━━━━『  INTELIGENCIA  』━━━━━━━━', orden: 260, color: '#1a1a1e' },
  { key: 'SEP.CD', nombreRol: '━━━━━━━━『  CLASE D  』━━━━━━━━', orden: 300, color: '#1a1a1e' },
  { key: 'SEP.CAOS', nombreRol: '━━━━━━━━『  INSURGENCIA  』━━━━━━━━', orden: 340, color: '#1a1a1e' },
  { key: 'SEP.PERMISOS', nombreRol: '━━━━━━━━『  PERMISOS  』━━━━━━━━', orden: 380, color: '#1a1a1e' },
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
        nombre: 'Director General de F.A.M',
        orden: 22,
        nivelMando: 1,
        aliases: [
          'director general de f.a.m',
          'director general de fam',
          'director general',
          'dir general',
          'dg',
        ],
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
        nombre: 'Director de Operaciones de Seguridad de F.A.M',
        orden: 24,
        nivelMando: 2,
        aliases: [
          'director de operaciones de seguridad de f.a.m',
          'director de operaciones de seguridad de fam',
          'director de operaciones de seguridad',
          'director de operaciones',
          'comandante de seguridad',
          'comandante seguridad',
        ],
      },
      {
        key: 'MED.DIRECTOR',
        nombre: 'Director Medico de F.A.M',
        orden: 25,
        nivelMando: 2,
        aliases: [
          'director medico de f.a.m',
          'director medico de fam',
          'director médico de f.a.m',
          'director medico',
          'director médico',
          'dir medico',
          'director de medicina',
        ],
      },
      {
        key: 'INV.DIRECTOR',
        nombre: 'Director de Investigacion Cientifica de F.A.M',
        orden: 26,
        nivelMando: 2,
        aliases: [
          'director de investigacion cientifica de f.a.m',
          'director de investigacion cientifica de fam',
          'director de investigación científica de f.a.m',
          'director de investigacion cientifica',
          'director de investigación científica',
          'director de investigacion',
          'director investigacion',
        ],
      },
    ],
  },

  moderacion: {
    prefijo: 'MOD',
    color: '#E67E22',
    nombre: 'Moderacion',
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
      { key: 'SEG.SUB_GUARDIA', nombre: 'Subcomandante de Guardia', orden: 122, nivelMando: 3, aliases: ['sub comandante de guardia', 'subcomandante de guardia', 'subcomandante guardia'] },
      { key: 'SEG.SUB_RR', nombre: 'Subcomandante de Respuesta Rapida', orden: 123, nivelMando: 3, aliases: ['subcomandante de respuesta rapida', 'subcomandante de respuesta rápida', 'sub comandante de respuesta rapida', 'subcomandante err', 'subcomandante rr'] },
      { key: 'SEG.SUB_FTM', nombre: 'Subcomandante de Fuerza de Trabajo Movil', orden: 124, nivelMando: 3, aliases: ['subcomandante de fuerza de trabajo mobil', 'subcomandante de fuerza de trabajo móvil', 'sub comandante de fuerza de trabajo mobil', 'subcomandante ftm'] },
      { key: 'SEG.CAPITAN', nombre: 'Capitan de Seguridad', orden: 125, nivelMando: 3, aliases: ['capitan de seguridad', 'capitán de seguridad', 'capitan'] },
      { key: 'SEG.TENIENTE', nombre: 'Teniente de Seguridad', orden: 126, nivelMando: 3, aliases: ['teniente de seguridad', 'teniente'] },
      { key: 'SEG.SARGENTO', nombre: 'Sargento de Seguridad', orden: 127, nivelMando: 4, aliases: ['sargento de seguridad', 'sargento'] },
      { key: 'SEG.CABO', nombre: 'Cabo de Seguridad', orden: 128, nivelMando: 4, aliases: ['cabo de seguridad', 'cabo'] },
      { key: 'SEG.SOLDADO', nombre: 'Soldado de Seguridad', orden: 129, nivelMando: 4, aliases: ['soldado de seguridad', 'soldado'] },
      { key: 'SEG.CADETE', nombre: 'Cadete de Seguridad', orden: 130, nivelMando: 4, aliases: ['cadete de seguridad', 'cadete'] },
