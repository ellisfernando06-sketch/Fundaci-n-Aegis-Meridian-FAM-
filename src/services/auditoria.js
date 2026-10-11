const { getDb } = require('../db');

/**
 * Registra una acción en el log de auditoría.
 * @param {string} actor - ID de Discord del autor o 'SISTEMA'
 * @param {string} accion - Código de la acción (ej. PERSONAL.ASCENDER, ACCESO_DENEGADO)
 * @param {string|object} detalle - Descripción o datos adicionales
 */
function registrar(actor, accion, detalle = '') {
  const db = getDb();
  const texto = typeof detalle === 'string' ? detalle : JSON.stringify(detalle);
  db.prepare(
    'INSERT INTO auditoria (actor, accion, detalle) VALUES (?, ?, ?)'
  ).run(String(actor), accion, texto);
}

/**
 * Consulta entradas de auditoría con filtros opcionales.
 */
function consultar({ actor = null, accion = null, limite = 50, offset = 0 } = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM auditoria WHERE 1=1';
  const params = [];

  if (actor) {
    sql += ' AND actor = ?';
    params.push(actor);
  }
  if (accion) {
    sql += ' AND accion LIKE ?';
    params.push(`%${accion}%`);
  }

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limite, offset);

  return db.prepare(sql).all(...params);
}

module.exports = {
  registrar,
  consultar,
};
