/**
 * Operaciones de campo · Fundacion Aegis-Meridian
 */

const { getDb, nextId, getConfig, setConfig } = require('../db');
const { ALERTAS, CLASES_CONTENCION_DEFAULT } = require('../data/organigrama');
const auditoria = require('./auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');

const ESTADOS_ANOMALIA = ['En revision', 'Contenida', 'En estudio', 'Perdida', 'Neutralizada'];
const GRAVEDADES = ['Baja', 'Media', 'Alta', 'Critica'];
const ESTADOS_INCIDENTE = ['Abierto', 'En curso', 'Contenido', 'Cerrado'];
const PRIORIDADES_MISION = ['Baja', 'Normal', 'Alta', 'Urgente'];
const ESTADOS_MISION = ['Pendiente', 'En curso', 'Completada', 'Cancelada', 'Fallida'];

function colorAlerta(nivel) {
  const a = ALERTAS.find((x) => x.codigo.toLowerCase() === String(nivel || '').toLowerCase());
  if (!a) return COLORES.neutral;
  return parseInt(String(a.color).replace('#', ''), 16);
}

function emojiAlerta(nivel) {
  const a = ALERTAS.find((x) => x.codigo.toLowerCase() === String(nivel || '').toLowerCase());
  return a?.emoji || '⚪';
}

function clasesDisponibles() {
  try {
    const raw = getConfig('clases_contencion');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return CLASES_CONTENCION_DEFAULT;
}

function sitiosDisponibles() {
  try {
    const raw = getConfig('sitios');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return ['Sitio Meridiano'];
}

function embedAnomalia(a) {
  return embedBase({
    color: COLORES.investigacion,
    titulo: `${a.id} · ${a.nombre}`,
    campos: [
      { name: 'Clase', value: a.clase || '—', inline: true },
      { name: 'Nivel acceso', value: String(a.nivel_acceso ?? '—'), inline: true },
      { name: 'Estado', value: a.estado || '—', inline: true },
      { name: 'Sitio', value: a.sitio || '—', inline: true },
      { name: 'Investigador', value: a.investigador_id ? `<@${a.investigador_id}>` : '—', inline: true },
      { name: 'Creado por', value: a.creado_por || '—', inline: true },
      { name: 'Protocolos', value: truncar(a.protocolos || '—', 500), inline: false },
      { name: 'Descripcion', value: truncar(a.descripcion || '—', 800), inline: false },
    ],
    footer: 'Registro de anomalias',
  });
}

function embedIncidente(i) {
  return embedBase({
    color: i.gravedad === 'Critica' || i.gravedad === 'Alta' ? COLORES.sancion : COLORES.seguridad,
    titulo: `${i.id} · Incidente`,
    campos: [
      { name: 'Gravedad', value: i.gravedad || '—', inline: true },
      { name: 'Estado', value: i.estado || '—', inline: true },
      { name: 'Ubicacion', value: i.ubicacion || '—', inline: true },
      { name: 'Anomalia', value: i.anomalia_id || '—', inline: true },
      { name: 'Unidad', value: i.unidad || '—', inline: true },
      { name: 'Reportado por', value: i.reportado_por ? `<@${i.reportado_por}>` : '—', inline: true },
      { name: 'Resumen', value: truncar(i.resumen || '—', 800), inline: false },
    ],
    footer: 'Incidentes',
  });
}

function embedMision(m) {
  return embedBase({
    color: COLORES.seguridad,
    titulo: `${m.id} · Mision`,
    campos: [
      { name: 'Prioridad', value: m.prioridad || '—', inline: true },
      { name: 'Estado', value: m.estado || '—', inline: true },
      { name: 'Unidad', value: m.unidad || '—', inline: true },
      { name: 'Lider', value: m.lider_id ? `<@${m.lider_id}>` : '—', inline: true },
      { name: 'Anomalia', value: m.anomalia_id || '—', inline: true },
      { name: 'Autorizada por', value: m.autorizada_por || '—', inline: true },
      { name: 'Objetivo', value: truncar(m.objetivo || '—', 800), inline: false },
      { name: 'Fecha limite', value: m.fecha_limite || '—', inline: true },
    ],
    footer: 'Misiones',
  });
}

function embedAlertaActual() {
  const nivel = getConfig('alerta_actual') || 'Verde';
  const mensaje = getConfig('alerta_mensaje') || 'Sitio en estado normal de operaciones.';
  return embedBase({
    color: colorAlerta(nivel),
    titulo: `${emojiAlerta(nivel)} Alerta · ${nivel}`,
    descripcion: mensaje,
    footer: 'Estado del sitio',
  });
}

function crearAnomalia({ nombre, clase, nivelAcceso, sitio, protocolos, descripcion, investigadorId, creadoPor }) {
  const db = getDb();
  const id = nextId('FAM');
  db.prepare(`
    INSERT INTO anomalias (id, nombre, clase, nivel_acceso, sitio, estado, protocolos, descripcion, investigador_id, creado_por)
    VALUES (?, ?, ?, ?, ?, 'En revision', ?, ?, ?, ?)
  `).run(
    id,
    sanitizar(nombre),
    clase,
    nivelAcceso,
    sitio || null,
    protocolos ? sanitizar(protocolos) : null,
    descripcion ? sanitizar(descripcion) : null,
    investigadorId || null,
    creadoPor
  );
  auditoria.registrar(creadoPor, 'ANOMALIA.CREAR', { id, nombre, clase });
  return db.prepare('SELECT * FROM anomalias WHERE id = ?').get(id);
}

function actualizarAnomalia(id, campos, actor) {
  const db = getDb();
  const a = db.prepare('SELECT * FROM anomalias WHERE id = ?').get(id);
  if (!a) throw new Error('Anomalia no encontrada');
  const allowed = ['nombre', 'clase', 'nivel_acceso', 'sitio', 'estado', 'protocolos', 'descripcion', 'investigador_id'];
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(campos)) {
    if (!allowed.includes(k) || v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(typeof v === 'string' ? sanitizar(v) : v);
  }
  if (!sets.length) return a;
  sets.push(`actualizado_en = datetime('now')`);
  vals.push(id);
  db.prepare(`UPDATE anomalias SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  auditoria.registrar(actor, 'ANOMALIA.ACTUALIZAR', { id, campos: Object.keys(campos) });
  return db.prepare('SELECT * FROM anomalias WHERE id = ?').get(id);
}

function crearIncidente({ gravedad, ubicacion, anomaliaId, unidad, resumen, reportadoPor }) {
  const db = getDb();
  if (anomaliaId) {
    const a = db.prepare('SELECT id FROM anomalias WHERE id = ?').get(anomaliaId);
    if (!a) throw new Error('Anomalia vinculada no existe');
  }
  const id = nextId('INC');
  db.prepare(`
    INSERT INTO incidentes (id, gravedad, estado, ubicacion, anomalia_id, unidad, reportado_por, resumen)
    VALUES (?, ?, 'Abierto', ?, ?, ?, ?, ?)
  `).run(
    id,
    gravedad,
    ubicacion ? sanitizar(ubicacion) : null,
    anomaliaId || null,
    unidad ? sanitizar(unidad) : null,
    reportadoPor,
    resumen ? sanitizar(resumen) : null
  );
  auditoria.registrar(reportadoPor, 'INCIDENTE.CREAR', { id, gravedad, anomaliaId });
  return db.prepare('SELECT * FROM incidentes WHERE id = ?').get(id);
}

function actualizarIncidente(id, campos, actor) {
  const db = getDb();
  const i = db.prepare('SELECT * FROM incidentes WHERE id = ?').get(id);
  if (!i) throw new Error('Incidente no encontrado');
  const allowed = ['gravedad', 'estado', 'ubicacion', 'anomalia_id', 'unidad', 'resumen', 'cerrado_por', 'cerrado_en'];
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(campos)) {
    if (!allowed.includes(k) || v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(typeof v === 'string' ? sanitizar(v) : v);
  }
  if (!sets.length) return i;
  vals.push(id);
  db.prepare(`UPDATE incidentes SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  auditoria.registrar(actor, 'INCIDENTE.ACTUALIZAR', { id, campos: Object.keys(campos) });
  return db.prepare('SELECT * FROM incidentes WHERE id = ?').get(id);
}

function declararAlerta({ nivel, mensaje, sitio, declaradaPor }) {
  const anterior = getConfig('alerta_actual') || 'Verde';
  const msg = mensaje ? sanitizar(mensaje) : `Alerta ${nivel} declarada.`;
  setConfig('alerta_actual', nivel);
  setConfig('alerta_mensaje', msg);
  const db = getDb();
  db.prepare(`
    INSERT INTO alertas (nivel, nivel_anterior, mensaje, declarada_por, sitio)
    VALUES (?, ?, ?, ?, ?)
  `).run(nivel, anterior, msg, declaradaPor, sitio || null);
  auditoria.registrar(declaradaPor, 'ALERTA.DECLARAR', { nivel, anterior, sitio });
  return { nivel, anterior, mensaje: msg, sitio };
}

function crearMision({ unidad, prioridad, liderId, objetivo, anomaliaId, autorizadaPor, fechaLimite }) {
  const db = getDb();
  if (anomaliaId) {
    const a = db.prepare('SELECT id FROM anomalias WHERE id = ?').get(anomaliaId);
    if (!a) throw new Error('Anomalia vinculada no existe');
  }
  const id = nextId('MIS');
  db.prepare(`
    INSERT INTO misiones (id, unidad, prioridad, lider_id, estado, objetivo, anomalia_id, autorizada_por, fecha_limite)
    VALUES (?, ?, ?, ?, 'Pendiente', ?, ?, ?, ?)
  `).run(
    id,
    unidad ? sanitizar(unidad) : null,
    prioridad || 'Normal',
    liderId || null,
    objetivo ? sanitizar(objetivo) : null,
    anomaliaId || null,
    autorizadaPor,
    fechaLimite || null
  );
  auditoria.registrar(autorizadaPor, 'MISION.CREAR', { id, prioridad, anomaliaId });
  return db.prepare('SELECT * FROM misiones WHERE id = ?').get(id);
}

function actualizarMision(id, campos, actor) {
  const db = getDb();
  const m = db.prepare('SELECT * FROM misiones WHERE id = ?').get(id);
  if (!m) throw new Error('Mision no encontrada');
  const allowed = ['unidad', 'prioridad', 'lider_id', 'estado', 'objetivo', 'anomalia_id', 'fecha_limite'];
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(campos)) {
    if (!allowed.includes(k) || v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(typeof v === 'string' ? sanitizar(v) : v);
  }
  if (!sets.length) return m;
  vals.push(id);
  db.prepare(`UPDATE misiones SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  auditoria.registrar(actor, 'MISION.ACTUALIZAR', { id, campos: Object.keys(campos) });
  return db.prepare('SELECT * FROM misiones WHERE id = ?').get(id);
}

module.exports = {
  ESTADOS_ANOMALIA,
  GRAVEDADES,
  ESTADOS_INCIDENTE,
  PRIORIDADES_MISION,
  ESTADOS_MISION,
  ALERTAS,
  colorAlerta,
  emojiAlerta,
  clasesDisponibles,
  sitiosDisponibles,
  embedAnomalia,
  embedIncidente,
  embedMision,
  embedAlertaActual,
  crearAnomalia,
  actualizarAnomalia,
  crearIncidente,
  actualizarIncidente,
  declararAlerta,
  crearMision,
  actualizarMision,
};
