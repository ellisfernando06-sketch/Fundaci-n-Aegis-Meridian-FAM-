/**
 * Automatizacion de roleplay operativo · F.A.M.
 */

const { getDb, nextId, getConfig } = require('../db');
const auditoria = require('./auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');

function asegurarTablas() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS turnos (
      id TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL,
      personaje TEXT,
      area TEXT,
      estado TEXT DEFAULT 'activo',
      inicio TEXT DEFAULT (datetime('now')),
      fin TEXT,
      notas TEXT
    );
    CREATE TABLE IF NOT EXISTS radio_logs (
      id TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL,
      frecuencia TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      canal_id TEXT,
      creado_en TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS zonas_acceso (
      id TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL,
      zona TEXT NOT NULL,
      nivel INTEGER DEFAULT 0,
      estado TEXT DEFAULT 'activo',
      otorgado_por TEXT,
      motivo TEXT,
      creado_en TEXT DEFAULT (datetime('now')),
      expira_en TEXT
    );
    CREATE TABLE IF NOT EXISTS registros_sitio (
      id TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      zona TEXT,
      detalle TEXT,
      creado_en TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS briefings (
      id TEXT PRIMARY KEY,
      mision_id TEXT,
      titulo TEXT NOT NULL,
      contenido TEXT NOT NULL,
      autor_id TEXT NOT NULL,
      canal_id TEXT,
      msg_id TEXT,
      creado_en TEXT DEFAULT (datetime('now'))
    );
  `);
}

const FRECUENCIAS = [
  { id: 'CMD', nombre: 'Comando', color: COLORES.cupula },
  { id: 'SEG', nombre: 'Seguridad', color: COLORES.seguridad },
  { id: 'SI', nombre: 'Seguridad Interna', color: COLORES.sancion },
  { id: 'MED', nombre: 'Medicina', color: COLORES.medicina },
  { id: 'INV', nombre: 'Investigacion', color: COLORES.investigacion },
  { id: 'INT', nombre: 'Inteligencia', color: COLORES.inteligencia },
  { id: 'EMG', nombre: 'Emergencia', color: COLORES.rojo },
  { id: 'GEN', nombre: 'General', color: COLORES.neutral },
];

const ZONAS = [
  'Superficie', 'Lobby', 'Oficinas', 'Contencion ligera', 'Contencion media',
  'Contencion pesada', 'Laboratorios', 'Ala medica', 'Armeria', 'Celdas SI',
  'Clase D', 'Hangar', 'Sotano tecnico', 'Zona restringida',
];

async function publicarLog(guild, tipoConfig, payload) {
  const canalId =
    getConfig(tipoConfig) ||
    getConfig('canal_logs') ||
    getConfig('canal_operaciones');
  if (!canalId || !guild) return;
  try {
    const ch = await guild.channels.fetch(canalId).catch(() => null);
    if (ch?.isTextBased()) await ch.send(payload);
  } catch (err) {
    console.warn('[roleplay log]', err.message);
  }
}

function turnoActivo(discordId) {
  asegurarTablas();
  return getDb()
    .prepare("SELECT * FROM turnos WHERE discord_id = ? AND estado = 'activo' ORDER BY inicio DESC LIMIT 1")
    .get(discordId) || null;
}

function abrirTurno(discordId, personaje, area, notas) {
  asegurarTablas();
  const activo = turnoActivo(discordId);
  if (activo) return { ok: false, motivo: 'Ya tienes un turno activo.', turno: activo };
  const id = nextId('TUR');
  getDb()
    .prepare('INSERT INTO turnos (id, discord_id, personaje, area, notas) VALUES (?, ?, ?, ?, ?)')
    .run(id, discordId, personaje || null, area || null, notas || null);
  auditoria.registrar(discordId, 'TURNO.INICIO', { id, area });
  return { ok: true, turno: getDb().prepare('SELECT * FROM turnos WHERE id = ?').get(id) };
}

function cerrarTurno(discordId) {
  asegurarTablas();
  const activo = turnoActivo(discordId);
  if (!activo) return { ok: false, motivo: 'No tienes turno activo.' };
  getDb()
    .prepare("UPDATE turnos SET estado = 'cerrado', fin = datetime('now') WHERE id = ?")
    .run(activo.id);
  auditoria.registrar(discordId, 'TURNO.FIN', { id: activo.id });
  return { ok: true, turno: { ...activo, estado: 'cerrado', fin: new Date().toISOString() } };
}

function emitirRadio(discordId, frecuencia, mensaje, canalId) {
  asegurarTablas();
  const id = nextId('RAD');
  getDb()
    .prepare('INSERT INTO radio_logs (id, discord_id, frecuencia, mensaje, canal_id) VALUES (?, ?, ?, ?, ?)')
    .run(id, discordId, frecuencia, sanitizar(mensaje).slice(0, 500), canalId || null);
  auditoria.registrar(discordId, 'RADIO.TX', { id, frecuencia });
  return { id, frecuencia, mensaje: sanitizar(mensaje).slice(0, 500) };
}

function otorgarZona(discordId, zona, nivel, otorgante, motivo, horas) {
  asegurarTablas();
  const id = nextId('ZON');
  let expira = null;
  if (horas && horas > 0) {
    expira = new Date(Date.now() + horas * 3600 * 1000).toISOString();
  }
  getDb()
    .prepare(
      `INSERT INTO zonas_acceso (id, discord_id, zona, nivel, otorgado_por, motivo, expira_en)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, discordId, zona, nivel || 0, otorgante, motivo || null, expira);
  auditoria.registrar(discordId, 'ZONA.OTORGAR', { id, zona, nivel });
  return getDb().prepare('SELECT * FROM zonas_acceso WHERE id = ?').get(id);
}

function zonasDe(discordId) {
  asegurarTablas();
  return getDb()
    .prepare(
      `SELECT * FROM zonas_acceso WHERE discord_id = ? AND estado = 'activo'
       AND (expira_en IS NULL OR expira_en > datetime('now')) ORDER BY creado_en DESC`
    )
    .all(discordId);
}

function registrarSitio(discordId, tipo, zona, detalle) {
  asegurarTablas();
  const id = nextId('REG');
  getDb()
    .prepare('INSERT INTO registros_sitio (id, discord_id, tipo, zona, detalle) VALUES (?, ?, ?, ?, ?)')
    .run(id, discordId, tipo, zona || null, detalle ? sanitizar(detalle).slice(0, 500) : null);
  auditoria.registrar(discordId, 'REGISTRO.SITIO', { id, tipo, zona });
  return getDb().prepare('SELECT * FROM registros_sitio WHERE id = ?').get(id);
}

function crearBriefing(autorId, titulo, contenido, misionId) {
  asegurarTablas();
  const id = nextId('BRF');
  getDb()
    .prepare('INSERT INTO briefings (id, mision_id, titulo, contenido, autor_id) VALUES (?, ?, ?, ?, ?)')
    .run(id, misionId || null, sanitizar(titulo).slice(0, 120), sanitizar(contenido).slice(0, 2000), autorId);
  auditoria.registrar(autorId, 'BRIEFING.CREAR', { id });
  return getDb().prepare('SELECT * FROM briefings WHERE id = ?').get(id);
}

function embedRadio(freq, autorTag, mensaje, id) {
  const meta = FRECUENCIAS.find((f) => f.id === freq) || FRECUENCIAS[FRECUENCIAS.length - 1];
  return embedBase({
    color: meta.color,
    author: true,
    titulo: `Radio · ${meta.nombre} [${freq}]`,
    descripcion: truncar(mensaje, 1800),
    campos: [
      { name: 'Emisor', value: autorTag, inline: true },
      { name: 'ID', value: id, inline: true },
    ],
    footer: 'Comunicaciones',
  });
}

function embedTurno(turno, accion) {
  return embedBase({
    color: accion === 'inicio' ? COLORES.medicina : COLORES.neutral,
    author: true,
    titulo: accion === 'inicio' ? `Turno iniciado · ${turno.id}` : `Turno cerrado · ${turno.id}`,
    campos: [
      { name: 'Personal', value: `<@${turno.discord_id}>`, inline: true },
      { name: 'Area', value: turno.area || '—', inline: true },
      { name: 'Personaje', value: turno.personaje || '—', inline: true },
      { name: 'Inicio', value: turno.inicio || '—', inline: true },
      { name: 'Fin', value: turno.fin || '—', inline: true },
    ],
    footer: 'Turnos',
  });
}

module.exports = {
  asegurarTablas,
  FRECUENCIAS,
  ZONAS,
  publicarLog,
  turnoActivo,
  abrirTurno,
  cerrarTurno,
  emitirRadio,
  otorgarZona,
  zonasDe,
  registrarSitio,
  crearBriefing,
  embedRadio,
  embedTurno,
};
