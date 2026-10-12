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
  getJerarquiaCompleta,
  getOrganigramaTexto,
  nombreBaseRol,
} = require('../data/organigrama');
const { normalizarNombre, truncar } = require('../utils/helpers');
const { onColoresConfirmar, onColoresEjecutar } = require('./config_roles_colores');

const prefix = 'config_roles';

function esAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

function asegurarColumnaOrigen() {
  try {
    getDb().exec(`ALTER TABLE roles_map ADD COLUMN origen TEXT DEFAULT 'existente'`);
  } catch (_) {}
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

function nombreOficial(item) {
  return item.nombreRol || item.nombre || item.key;
}

function existeExacto(rolDiscord, item) {
  const oficial = normalizarNombre(nombreOficial(item));
  const nom = normalizarNombre(rolDiscord.name);
  const base = normalizarNombre(nombreBaseRol(rolDiscord.name));
  if (!oficial) return false;
  if (nom === oficial) return true;
  if (item.tipo === 'separador' && (nom === oficial || base === oficial)) return true;
  if (item.nombre && base === normalizarNombre(item.nombre)) return true;
  return false;
}

function escanear(guild) {
  const roles = [...guild.roles.cache.values()].filter(
    (r) => r.id !== guild.id && !r.managed
  );
  const catalogo = getJerarquiaCompleta();
  const usados = new Set();
  const detectados = [];
  const faltantes = [];
  const aRenombrar = [];

  for (const item of catalogo) {
    let match = null;
    for (const rol of roles) {
      if (usados.has(rol.id)) continue;
      if (existeExacto(rol, item)) {
        match = rol;
        break;
      }
    }
    if (match) {
      detectados.push({ item, rol: match });
      usados.add(match.id);
      guardarMapa(item.key, match.id, match.name, 'existente');
      const destino = String(nombreOficial(item)).slice(0, 100);
      if (match.name !== destino) {
        aRenombrar.push({
          item,
          rol: match,
          nombreActual: match.name,
          nombreDestino: destino,
        });
      }
    } else {
      faltantes.push(item);
    }
  }
  return { detectados, faltantes, aRenombrar, rolesLeidos: roles.length, catalogo };
}

async function handle(interaction, accion, args) {
  if (!esAdmin(interaction)) {
    await interaction.reply({
      content: 'No tienes autorizacion para esta accion.',
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
    return;
  }
  const ownerId = args[0];
  if (ownerId && ownerId !== interaction.user.id) {
    await interaction.reply({
      content: 'Solo quien abrio el menu puede usarlo.',
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
    return;
  }

  if (accion === 'eliminar_todos_ejecutar' || accion === 'eliminar_todos_cancelar') {
    const h = require('./eliminar_todos_handlers');
    return h.handle(
      interaction,
      accion === 'eliminar_todos_ejecutar' ? 'ejecutar' : 'cancelar',
      args
    );
  }

  switch (accion) {
    case 'menu': return onMenu(interaction);
    case 'crear_confirmar':
    case 'desplegar_ejecutar':
    case 'crear_ejecutar': return onCrearEjecutar(interaction);
    case 'renombrar_confirmar': return onRenombrarConfirmar(interaction);
    case 'renombrar_ejecutar': return onRenombrarEjecutar(interaction);
    case 'organizar_confirmar': return onOrganizarConfirmar(interaction);
    case 'organizar_ejecutar': return onOrganizarEjecutar(interaction);
    case 'eliminar_confirmar': return onEliminarConfirmar(interaction);
    case 'eliminar_ejecutar': return onEliminarEjecutar(interaction);
    case 'colores_confirmar': return onColoresConfirmar(interaction);
    case 'colores_ejecutar': return onColoresEjecutar(interaction);
    default:
      await interaction.reply({
        content: 'Accion no reconocida.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
  }
}

async function onMenu(interaction) {
  const opcion = interaction.values[0];
  if (opcion === 'organigrama') return verOrganigrama(interaction);
  if (opcion === 'analizar') return analizar(interaction);
  if (opcion === 'crear' || opcion === 'desplegar') return onCrearConfirmar(interaction);
  if (opcion === 'renombrar') return onRenombrarConfirmar(interaction);
  if (opcion === 'organizar') return onOrganizarConfirmar(interaction);
  if (opcion === 'eliminar_bot') return onEliminarConfirmar(interaction);
  if (opcion === 'colores') return onColoresConfirmar(interaction);
}

module.exports = { prefix, handle, escanear, nombreOficial, guardarMapa, esAdmin };
