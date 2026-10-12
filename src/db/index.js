const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { SCHEMA } = require('./schema');
const { LLAVES_INICIALES } = require('../data/llaves');
const { SITIOS_DEFAULT, CLASES_CONTENCION_DEFAULT } = require('../data/organigrama');

let db = null;

function resolverRutaDb() {
  const preferida = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'aegis.db');
  const candidatos = [
    preferida,
    path.join('/tmp', 'aegis.db'),
    path.join(process.cwd(), 'aegis.db'),
  ];

  for (const dbPath of candidatos) {
    try {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const testFile = path.join(dir, '.aegis_write_test');
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      return dbPath;
    } catch (err) {
      console.warn('[AEGIS] No se pudo usar', dbPath, '→', err.message);
    }
  }

  throw new Error('No hay ninguna ruta escribible para la base de datos');
}

function getDb() {
  if (db) return db;

  const dbPath = resolverRutaDb();
  console.log('[AEGIS] Abriendo base de datos en', dbPath);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(SCHEMA);
  seedInicial();

  return db;
}

function upsertLlaves() {
  const insert = db.prepare(`
    INSERT INTO llaves (id, nombre, funcion, nombre_rol, tipo, rama, alcance, nivel_min, otorgan_json, canales_json, activa)
    VALUES (@id, @nombre, @funcion, @nombre_rol, @tipo, @rama, @alcance, @nivelMin, @otorgan_json, '[]', 1)
    ON CONFLICT(id) DO UPDATE SET
      nombre = excluded.nombre,
      funcion = excluded.funcion,
      nombre_rol = excluded.nombre_rol,
      tipo = excluded.tipo,
      rama = excluded.rama,
      alcance = excluded.alcance,
      nivel_min = excluded.nivel_min,
      otorgan_json = excluded.otorgan_json,
      actualizado_en = datetime('now')
  `);
  const tx = db.transaction((llaves) => {
    for (const l of llaves) {
      insert.run({
        id: l.id,
        nombre: l.nombre,
        funcion: l.funcion,
        nombre_rol: `[KEY] ${l.nombre}`,
        tipo: l.tipo,
        rama: l.rama || null,
        alcance: l.alcance || null,
        nivelMin: l.nivelMin ?? 0,
        otorgan_json: l.otorgan ? JSON.stringify(l.otorgan) : null,
      });
    }
  });
  tx(LLAVES_INICIALES);
}

function seedInicial() {
  upsertLlaves();
  console.log('[AEGIS] Llaves sincronizadas:', LLAVES_INICIALES.length);

  const countConfig = db.prepare('SELECT COUNT(*) AS c FROM config').get().c;
  if (countConfig === 0) {
    const set = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?)');
    set.run('sitios', JSON.stringify(SITIOS_DEFAULT));
    set.run('clases_contencion', JSON.stringify(CLASES_CONTENCION_DEFAULT));
    set.run('alerta_actual', 'Verde');
    set.run('alerta_mensaje', 'Sitio en estado normal de operaciones.');
  }

  const canalInterna = db.prepare("SELECT valor FROM config WHERE clave = 'canal_interna'").get();
  if (!canalInterna) {
    db.prepare("INSERT OR IGNORE INTO config (clave, valor) VALUES ('canal_interna', '')").run();
  }

  // Incluye contadores de tickets, finanzas y tienda
  const contadores = [
    'PER', 'AP', 'FAM', 'INC', 'MIS', 'SAN', 'EXP', 'SOL', 'CAS',
    'TKT', 'TRF', 'FIN', 'ITM', 'CMP',
  ];
  const insertCont = db.prepare('INSERT OR IGNORE INTO contadores (tipo, valor) VALUES (?, 0)');
  for (const t of contadores) {
    insertCont.run(t);
  }
}

/**
 * Genera ID secuencial. Crea el contador si no existe (evita TKT-0001 duplicado).
 */
function nextId(tipo) {
  const d = getDb();
  d.prepare('INSERT OR IGNORE INTO contadores (tipo, valor) VALUES (?, 0)').run(tipo);
  const row = d.prepare('SELECT valor FROM contadores WHERE tipo = ?').get(tipo);
  const nuevo = (row ? Number(row.valor) : 0) + 1;
  d.prepare('UPDATE contadores SET valor = ? WHERE tipo = ?').run(nuevo, tipo);
  return `${tipo}-${String(nuevo).padStart(4, '0')}`;
}

function getConfig(clave) {
  const row = getDb().prepare('SELECT valor FROM config WHERE clave = ?').get(clave);
  return row ? row.valor : null;
}

function setConfig(clave, valor) {
  getDb().prepare(
    'INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor'
  ).run(clave, typeof valor === 'string' ? valor : JSON.stringify(valor));
}

module.exports = {
  getDb,
  nextId,
  getConfig,
  setConfig,
};
