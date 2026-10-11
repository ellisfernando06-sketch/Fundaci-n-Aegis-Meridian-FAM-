const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb } = require('../db');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');
const {
  ROLES_IGNORAR,
  getJerarquiaCompleta,
  nombreBaseRol,
} = require('../data/organigrama');
const {
  normalizarNombre,
  coberturaTokens,
  similitudDice,
  truncar,
} = require('../utils/helpers');
const { onEliminarTodosCancelar, onEliminarTodosEjecutar } = require('./eliminar_todos_handlers');

const prefix = 'config_roles';
const UMBRAL = 0.55;

function esAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

function asegurarColumnaOrigen() {
  try { getDb().exec(`ALTER TABLE roles_map ADD COLUMN origen TEXT DEFAULT 'existente'`); } catch (_) {}
}

function guardarMapa(cargoKey, roleId, nombreRol, origen) {
  const db = getDb();
  asegurarColumnaOrigen();
  db.prepare(
    `INSERT INTO roles_map (cargo_key, role_id, nombre_rol, origen) VALUES (?, ?, ?, ?)
     ON CONFLICT(cargo_key) DO UPDATE SET
       role_id = excluded.role_id, nombre_rol = excluded.nombre_rol,
       origen = excluded.origen, actualizado_en = datetime('now')`
  ).run(cargoKey, roleId, nombreRol, origen);
}

function debeIgnorar(nombre) {
  const n = normalizarNombre(nombre);
  if (!n) return true;
  if (n === 'bot oficial' || n === 'bots' || n === 'bot') return true;
  if (n.startsWith('bot oficial')) return true;
  return false;
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** ¿El texto contiene la palabra completa? */
function tienePalabra(texto, palabra) {
  if (!texto || !palabra) return false;
  const re = new RegExp(`(?:^|\\s)${escapeRe(palabra)}(?:\\s|$)`);
  return re.test(texto);
}

function textosEsperados(item) {
  con