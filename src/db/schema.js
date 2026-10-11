/**
 * Esquema de la base de datos SQLite de la Fundación Aegis-Meridian
 * Se ejecuta en la primera arranque del bot.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS perfiles (
  discord_id TEXT PRIMARY KEY,
  numero INTEGER UNIQUE,
  personaje TEXT,
  roblox_id TEXT UNIQUE,
  roblox_usuario TEXT,
  verificado INTEGER DEFAULT 0,
  area TEXT,
  cargo TEXT,
  nivel_auth INTEGER DEFAULT 0,
  estado TEXT DEFAULT 'Visitante',
  ingreso TEXT,
  supervisor_id TEXT,
  ficha_msg_id TEXT,
  creado_en TEXT DEFAULT (datetime('now')),
  actualizado_en TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS verificaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  roblox_id TEXT NOT NULL,
  roblox_usuario TEXT,
  codigo TEXT NOT NULL,
  area_solicitada TEXT,
  personaje TEXT,
  creado_en TEXT DEFAULT (datetime('now')),
  vence_en TEXT NOT NULL,
  usado INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS historial_personal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE,
  discord_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  area TEXT,
  rango_anterior TEXT,
  rango_nuevo TEXT,
  autorizado_por TEXT,
  motivo TEXT,
  fecha TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS anomalias (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  clase TEXT NOT NULL,
  nivel_acceso INTEGER NOT NULL,
  sitio TEXT,
  estado TEXT DEFAULT 'En revisión',
  protocolos TEXT,
  descripcion TEXT,
  investigador_id TEXT,
  creado_por TEXT,
  msg_id TEXT,
  canal_id TEXT,
  creado_en TEXT DEFAULT (datetime('now')),
  actualizado_en TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS incidentes (
  id TEXT PRIMARY KEY,
  gravedad TEXT,
  estado TEXT DEFAULT 'Abierto',
  ubicacion TEXT,
  anomalia_id TEXT,
  unidad TEXT,
  reportado_por TEXT,
  resumen TEXT,
  cerrado_por TEXT,
  msg_id TEXT,
  creado_en TEXT DEFAULT (datetime('now')),
  cerrado_en TEXT,
  FOREIGN KEY (anomalia_id) REFERENCES anomalias(id)
);

CREATE TABLE IF NOT EXISTS alertas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nivel TEXT NOT NULL,
  nivel_anterior TEXT,
  mensaje TEXT,
  declarada_por TEXT,
  sitio TEXT,
  creado_en TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS misiones (
  id TEXT PRIMARY KEY,
  unidad TEXT,
  prioridad TEXT,
  lider_id TEXT,
  estado TEXT DEFAULT 'Pendiente',
  objetivo TEXT,
  anomalia_id TEXT,
  autorizada_por TEXT,
  fecha_limite TEXT,
  msg_id TEXT,
  creado_en TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (anomalia_id) REFERENCES anomalias(id)
);

CREATE TABLE IF NOT EXISTS sanciones (
  id TEXT PRIMARY KEY,
  sancionado_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  dias INTEGER,
  emitida_por TEXT,
  motivo TEXT,
  incidente_id TEXT,
  apelacion_hasta TEXT,
  estado TEXT DEFAULT 'Activa',
  msg_id TEXT,
  creado_en TEXT DEFAULT (datetime('now')),
  vence_en TEXT,
  FOREIGN KEY (incidente_id) REFERENCES incidentes(id)
);

CREATE TABLE IF NOT EXISTS casos_internos (
  id TEXT PRIMARY KEY,
  clasificacion TEXT DEFAULT 'Confidencial',
  estado TEXT DEFAULT 'Abierto',
  investigado_id TEXT,
  agente_id TEXT,
  resumen TEXT,
  creado_en TEXT DEFAULT (datetime('now')),
  cerrado_en TEXT
);

CREATE TABLE IF NOT EXISTS evidencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT NOT NULL,
  tipo TEXT,
  contenido TEXT,
  agregado_por TEXT,
  creado_en TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (caso_id) REFERENCES casos_internos(id)
);

CREATE TABLE IF NOT EXISTS solicitudes_area (
  id TEXT PRIMARY KEY,
  solicitante_id TEXT NOT NULL,
  area TEXT NOT NULL,
  rango_propuesto TEXT,
  motivo TEXT,
  estado TEXT DEFAULT 'Pendiente',
  revisado_por TEXT,
  msg_id TEXT,
  creado_en TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roles_map (
  cargo_key TEXT PRIMARY KEY,
  role_id TEXT NOT NULL,
  nombre_rol TEXT,
  actualizado_en TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS llaves (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  funcion TEXT NOT NULL,
  nombre_rol TEXT,
  tipo TEXT NOT NULL,
  rama TEXT,
  alcance TEXT,
  nivel_min INTEGER DEFAULT 0,
  otorgan_json TEXT,
  role_id TEXT,
  canales_json TEXT DEFAULT '[]',
  activa INTEGER DEFAULT 1,
  creado_en TEXT DEFAULT (datetime('now')),
  actualizado_en TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS llaves_titulares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  llave_id TEXT NOT NULL,
  discord_id TEXT NOT NULL,
  origen TEXT NOT NULL,
  otorgada_por TEXT,
  otorgada_en TEXT DEFAULT (datetime('now')),
  vence_en TEXT,
  motivo TEXT,
  activa INTEGER DEFAULT 1,
  FOREIGN KEY (llave_id) REFERENCES llaves(id)
);

CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT DEFAULT (datetime('now')),
  actor TEXT,
  accion TEXT NOT NULL,
  detalle TEXT
);

CREATE TABLE IF NOT EXISTS contadores (
  tipo TEXT PRIMARY KEY,
  valor INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_perfiles_roblox ON perfiles(roblox_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_area ON perfiles(area);
CREATE INDEX IF NOT EXISTS idx_llaves_titulares ON llaves_titulares(discord_id, llave_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha);
CREATE INDEX IF NOT EXISTS idx_anomalias_clase ON anomalias(clase);
`;

module.exports = { SCHEMA };
