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
      // Probar escritura
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

function seedInicial() {
  const countLlaves = db.prepare('SELECT COUNT(*) AS c FROM llaves').get().c;
  if (countLlaves === 0) {
    const insert = db.prepare(`
      INSERT INTO llaves (id, nombre, funcion, nombre_rol, tipo, rama, alcance, nivel_min, otorgan_json, canales_json, activa)
      VALUES (@id, @nombre, @funcion, @nombre_rol, @tipo, @rama, @alcance, @nivelMin, @otorgan_json, '[]', 1)
    `);
    const tx = db.transaction((llaves) => {
      for (const l of llaves) {
        insert.run({
          id: l.id,
          nombre: l.nombre,
          funcion: l.funcion,
          nombre_rol: `[KEY] ${l.nombre}`,
          tipo: l.tipo,
          rama: l.rama,
          alcance: l.alcance,
          nivelMin: l.nivelMin,
          otorgan_json: l.otorgan ? JSON.stringify(l.otorgan) : null,
        });
      }
    });
    tx(LLAVES_INICIALES);
    console.log('[AEGIS] Seed de llaves completado');
  }

  const countConfig = db.prepare('SELECT COUNT(*) AS c FROM config').get().c;
  if (countConfig === 0) {
    const set = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?)');
    set.run('sitios', JSON.stringify(SITIOS_DEFAULT));
    set.run('clases_contencion', JSON.stringify(CLASES_CONTENCION_DEFAULT));
    set.run('alerta_actual', 'Verde');
    set.run('alerta_mensaje', 'Sitio en estado normal de operaciones.');
  }

  const contadores = ['PER', 'AP', 'FAM', 'INC', 'MIS', 'SAN', 'EXP', 'SOL'];
  const insertCont = db.prepare('INSERT OR IGNORE INTO contadores (tipo, valor) VALUES (?, 0)');
  for (const t of contadores) {
    insertCont.run(t);
  }
}

function nextId(tipo) {
  const row = db.prepare('SELECT valor FROM contadores WHERE tipo = ?').get(tipo);
  const nuevo = (row ? row.valor : 0) + 1;
  db.prepare('UPDATE contadores SET valor = ? WHERE tipo = ?').run(nuevo, tipo);
  return `${tipo}-${String(nuevo).padStart(4, '0')}`;
}

function getConfig(clave) {
  const row = db.prepare('SELECT valor FROM config WHERE clave = ?').get(clave);
  return row ? row.valor : null;
}

function setConfig(clave, valor) {
  db.prepare(
    'INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor'
  ).run(clave, typeof valor === 'string' ? valor : JSON.stringify(valor));
}

module.exports = {
  getDb,
  nextId,
  getConfig,
  setConfig,
};
